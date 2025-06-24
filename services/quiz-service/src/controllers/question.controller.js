const Question = require('../models/Question');
const Quiz = require('../models/Quiz');
const mongoose = require('mongoose');

// Dodawanie pytania do quizu
exports.addQuestionToQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.user.id;

    // Sprawdź czy quiz istnieje i czy użytkownik ma uprawnienia
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const isOwner = quiz.createdBy === userId;
    const isAdmin = req.user.roles && req.user.roles.includes('admin');

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'You can only add questions to your own quizzes'
      });
    }

    // Przygotuj dane pytania
    const questionData = {
      ...req.body,
      createdBy: userId
    };

    // Walidacja typów pytań i odpowiedzi
    if (questionData.type === 'single' || questionData.type === 'multiple') {
      if (!questionData.options || questionData.options.length < 2) {
        return res.status(400).json({ 
          error: 'Single and multiple choice questions require at least 2 options'
        });
      }
      if (!questionData.correctAnswers || questionData.correctAnswers.length === 0) {
        return res.status(400).json({ 
          error: 'Correct answers are required'
        });
      }
    }

    if (questionData.type === 'boolean') {
      questionData.options = ['Prawda', 'Fałsz'];
      if (!questionData.correctAnswers || !['Prawda', 'Fałsz'].includes(questionData.correctAnswers[0])) {
        return res.status(400).json({ 
          error: 'Boolean questions require correct answer to be either "Prawda" or "Fałsz"'
        });
      }
    }

    // Utwórz pytanie
    const question = new Question(questionData);
    await question.save();

    // Dodaj do quizu
    await Quiz.findByIdAndUpdate(quizId, {
      $push: { questions: question._id }
    });

    res.status(201).json({
      message: 'Question added successfully',
      question
    });
  } catch (error) {
    console.error('[addQuestionToQuiz] Error:', error);
    res.status(400).json({ 
      error: 'Failed to add question', 
      details: error.message 
    });
  }
};

// Pobieranie pytań dla quizu
exports.getQuestionsForQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    
    const questions = await Question.find({ 
      _id: { $in: await Quiz.findById(quizId).then(quiz => quiz ? quiz.questions : []) }
    }).sort({ createdAt: 1 });

    res.json(questions);
  } catch (error) {
    console.error('[getQuestionsForQuiz] Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch questions',
      details: error.message
    });
  }
};

// Pobieranie pojedynczego pytania
exports.getQuestionById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const question = await Question.findById(id);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    res.json(question);
  } catch (error) {
    console.error('[getQuestionById] Error:', error);
    res.status(400).json({ 
      error: 'Invalid question ID',
      details: error.message
    });
  }
};

// Aktualizacja pytania
exports.updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const question = await Question.findById(id);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const isOwner = question.createdBy === userId;
    const isAdmin = req.user.roles && req.user.roles.includes('admin');

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only edit your own questions'
      });
    }

    // Walidacja typów pytań przed aktualizacją
    const updateData = req.body;
    if (updateData.type === 'single' || updateData.type === 'multiple') {
      if (updateData.options && updateData.options.length < 2) {
        return res.status(400).json({ 
          error: 'Single and multiple choice questions require at least 2 options'
        });
      }
    }

    if (updateData.type === 'boolean') {
      updateData.options = ['Prawda', 'Fałsz'];
      if (updateData.correctAnswers && !['Prawda', 'Fałsz'].includes(updateData.correctAnswers[0])) {
        return res.status(400).json({ 
          error: 'Boolean questions require correct answer to be either "Prawda" or "Fałsz"'
        });
      }
    }

    const updatedQuestion = await Question.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true, runValidators: true }
    );

    res.json({
      message: 'Question updated successfully',
      question: updatedQuestion
    });
  } catch (error) {
    console.error('[updateQuestion] Error:', error);
    res.status(400).json({ 
      error: 'Failed to update question',
      details: error.message
    });
  }
};

// Usuwanie pytania
exports.deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const question = await Question.findById(id);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const isOwner = question.createdBy === userId;
    const isAdmin = req.user.roles && req.user.roles.includes('admin');

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only delete your own questions'
      });
    }

    // Usuń pytanie z wszystkich quizów
    await Quiz.updateMany(
      { questions: id },
      { $pull: { questions: id } }
    );

    // Usuń pytanie
    await Question.findByIdAndDelete(id);

    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('[deleteQuestion] Error:', error);
    res.status(400).json({ 
      error: 'Failed to delete question',
      details: error.message
    });
  }
};

// Pobieranie pytań utworzonych przez użytkownika
exports.getUserQuestions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      type, 
      category, 
      difficulty,
      page = 1, 
      limit = 10 
    } = req.query;

    const filter = { createdBy: userId };
    
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (difficulty) filter.difficulty = difficulty;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const questions = await Question.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Question.countDocuments(filter);

    res.json({
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      questions
    });
  } catch (error) {
    console.error('[getUserQuestions] Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch user questions',
      details: error.message
    });
  }
}; 