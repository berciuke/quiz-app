const Quiz = require('../models/Quiz');
const Question = require('../models/Question');

exports.createQuiz = async (req, res) => {
  try {
    const quizData = {
      ...req.body,
      createdBy: req.user.id
    };

    const quiz = new Quiz(quizData);
    await quiz.save();

    res.status(201).json({
      message: 'Quiz created successfully',
      quiz
    });
  } catch (error) {
    console.error('[createQuiz] Error:', error);
    res.status(400).json({
      error: 'Failed to create quiz',
      details: error.message
    });
  }
};

exports.getAllQuizzes = async (req, res) => {
  try {
    const {
      category,
      difficulty,
      language,
      tags,
      keywords,
      isPublic,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 10
    } = req.query;

    const filter = { isActive: true };

    if (category) filter.category = category;
    if (difficulty) filter.difficulty = difficulty;
    if (language) filter.language = language;
    if (isPublic !== undefined) filter.isPublic = isPublic === 'true';
    
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      filter.tags = { $in: tagArray };
    }

    if (keywords) {
      const regex = new RegExp(keywords, 'i');
      filter.$or = [
        { title: regex },
        { description: regex },
        { tags: regex }
      ];
    }

    const sortOptions = {};
    const validSortFields = ['createdAt', 'views', 'playCount', 'title'];
    if (validSortFields.includes(sortBy)) {
      sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const quizzes = await Quiz.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('questions', 'text type')
      .select('-comments -ratings');

    const total = await Quiz.countDocuments(filter);

    res.json({
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      quizzes
    });
  } catch (error) {
    console.error('[getAllQuizzes] Error:', error);
    res.status(500).json({
      error: 'Failed to fetch quizzes',
      details: error.message
    });
  }
};

exports.getQuizById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const quiz = await Quiz.findById(id)
      .populate('questions')
      .exec();

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    if (!quiz.isPublic) {
      const isOwner = userId && quiz.createdBy === userId;
      const isInvited = userId && quiz.invitedUsers.includes(userId);
      
      if (!isOwner && !isInvited) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'This quiz is private'
        });
      }
    }

    if (userId) {
      quiz.views = (quiz.views || 0) + 1;
      await quiz.save();
    }

    res.json(quiz);
  } catch (error) {
    console.error('[getQuizById] Error:', error);
    res.status(400).json({
      error: 'Invalid quiz ID',
      details: error.message
    });
  }
};

exports.getUserQuizzes = async (req, res) => {
  try {
    const userId = req.user.id;

    const quizzes = await Quiz.find({ createdBy: userId })
      .sort({ createdAt: -1 })
      .populate('questions', 'text type')
      .exec();

    res.json(quizzes);
  } catch (error) {
    console.error('[getUserQuizzes] Error:', error);
    res.status(500).json({
      error: 'Failed to fetch user quizzes',
      details: error.message
    });
  }
};

exports.updateQuiz = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const quiz = await Quiz.findById(id);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const isOwner = quiz.createdBy === userId;
    const isAdmin = req.user.roles.includes('admin');

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only edit your own quizzes'
      });
    }

    const updatedQuiz = await Quiz.findByIdAndUpdate(
      id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    ).populate('questions');

    res.json({
      message: 'Quiz updated successfully',
      quiz: updatedQuiz
    });
  } catch (error) {
    console.error('[updateQuiz] Error:', error);
    res.status(400).json({
      error: 'Failed to update quiz',
      details: error.message
    });
  }
};

exports.deleteQuiz = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const quiz = await Quiz.findById(id);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const isOwner = quiz.createdBy === userId;
    const isAdmin = req.user.roles.includes('admin');

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only delete your own quizzes'
      });
    }

    await Quiz.findByIdAndDelete(id);

    res.json({
      message: 'Quiz deleted successfully'
    });
  } catch (error) {
    console.error('[deleteQuiz] Error:', error);
    res.status(400).json({
      error: 'Failed to delete quiz',
      details: error.message
    });
  }
};

exports.searchQuizzes = async (req, res) => {
  try {
    const {
      q,
      category,
      difficulty,
      tags,
      page = 1,
      limit = 10
    } = req.query;

    const filter = { isActive: true, isPublic: true };

    if (q) {
      const regex = new RegExp(q, 'i');
      filter.$or = [
        { title: regex },
        { description: regex },
        { tags: regex }
      ];
    }

    if (category) filter.category = category;
    if (difficulty) filter.difficulty = difficulty;
    
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      filter.tags = { $in: tagArray };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const quizzes = await Quiz.find(filter)
      .sort({ views: -1, playCount: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('title description category difficulty language tags playCount views createdAt createdBy')
      .exec();

    const total = await Quiz.countDocuments(filter);

    res.json({
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      quizzes
    });
  } catch (error) {
    console.error('[searchQuizzes] Error:', error);
    res.status(500).json({
      error: 'Search failed',
      details: error.message
    });
  }
};

exports.addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    const userId = req.user.id;
    const username = req.user.username;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    const quiz = await Quiz.findById(id);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const comment = {
      userId,
      username: username || 'Unknown User',
      text: text.trim(),
      createdAt: new Date()
    };

    quiz.comments.push(comment);
    await quiz.save();

    res.status(201).json({
      message: 'Comment added successfully',
      comment
    });
  } catch (error) {
    console.error('[addComment] Error:', error);
    res.status(500).json({
      error: 'Failed to add comment',
      details: error.message
    });
  }
};

exports.rateQuiz = async (req, res) => {
  try {
    const { id } = req.params;
    const { value } = req.body;
    const userId = req.user.id;

    if (!value || ![1, 2, 3, 4, 5].includes(parseInt(value))) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const quiz = await Quiz.findById(id);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const existingRating = quiz.ratings.find(r => r.userId === userId);
    
    if (existingRating) {
      existingRating.value = parseInt(value);
    } else {
      quiz.ratings.push({ userId, value: parseInt(value) });
    }

    await quiz.save();

    res.json({
      message: 'Rating saved successfully'
    });
  } catch (error) {
    console.error('[rateQuiz] Error:', error);
    res.status(500).json({
      error: 'Failed to save rating',
      details: error.message
    });
  }
}; 