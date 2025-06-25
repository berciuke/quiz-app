const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const Category = require('../models/Category');
const Tag = require('../models/Tag');

exports.createQuiz = async (req, res) => {
  try {
    let quizData = {
      ...req.body,
      createdBy: req.user.id
    };

    if (quizData.category && typeof quizData.category === 'string') {
      let category = await Category.findOne({ name: quizData.category });
      if (!category) {
        category = await Category.create({
          name: quizData.category,
          description: `Category for ${quizData.category}`
        });
      }
      quizData.category = category._id;
    }

    if (Array.isArray(quizData.tags)) {
      const tagIds = [];
      for (const tagName of quizData.tags) {
        let tag = await Tag.findOne({ name: tagName });
        if (!tag) {
          tag = await Tag.create({ 
            name: tagName, 
            description: `Tag for ${tagName}` 
          });
        }
        tagIds.push(tag._id);
      }
      quizData.tags = tagIds;
    }

    const quiz = new Quiz(quizData);
    await quiz.save();

    await quiz.populate('category tags');

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

    const userId = req.user?.id;
    const isAdmin = req.user?.roles && req.user.roles.includes('admin');
    const filter = { isActive: true };

    // Only show public quizzes by default, unless admin or explicitly requested
    if (isPublic !== undefined) {
      filter.isPublic = isPublic === 'true';
    } else if (!isAdmin) {
      // Non-admin users only see public quizzes by default
      filter.isPublic = true;
    }

    if (category) {
      const categoryDoc = await Category.findOne({ name: category });
      if (categoryDoc) {
        filter.category = categoryDoc._id;
      } else {
        return res.json({ total: 0, page: 1, limit: 10, quizzes: [] });
      }
    }

    if (difficulty) filter.difficulty = difficulty;
    if (language) filter.language = language;
    
    if (tags) {
      const tagNames = tags.split(',').map(tag => tag.trim());
      const tagDocs = await Tag.find({ name: { $in: tagNames } });
      const tagIds = tagDocs.map(tag => tag._id);
      filter.tags = { $in: tagIds };
    }

    if (keywords) {
      const regex = new RegExp(keywords, 'i');
      const tagDocs = await Tag.find({ name: regex });
      const tagIds = tagDocs.map(tag => tag._id);
      filter.$or = [
        { title: regex },
        { description: regex },
        { tags: { $in: tagIds } }
      ];
    }

    const sortOptions = {};
    const validSortFields = [
      'createdAt', 'views', 'playCount', 'title', 
      'averageRating', 'lastPlayedAt', 'weeklyPlayCount', 'monthlyPlayCount'
    ];
    
    if (validSortFields.includes(sortBy)) {
      sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
      
      // Dla popularności dodaj dodatkowe kryteria sortowania
      if (sortBy === 'views') {
        sortOptions.playCount = -1;
        sortOptions.averageRating = -1;
      } else if (sortBy === 'playCount') {
        sortOptions.views = -1;
        sortOptions.averageRating = -1;
      } else if (sortBy === 'averageRating') {
        sortOptions.ratingCount = -1;
        sortOptions.playCount = -1;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    let quizzes = await Quiz.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('questions', 'text type')
      .populate('category', 'name description')
      .populate('tags', 'name description')
      .select('-comments -ratings');

    // Filter out private quizzes that the user doesn't have access to
    if (!isAdmin) {
      quizzes = quizzes.filter(quiz => {
        if (quiz.isPublic) return true;
        if (quiz.createdBy === userId) return true;
        if (quiz.invitedUsers.includes(userId)) return true;
        return false;
      });
    }

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

    let quiz = await Quiz.findById(id)
      .populate('questions')
      .populate('category', 'name description')
      .populate('tags', 'name description')
      .exec();

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    if (!quiz.isPublic) {
      const isOwner = userId && quiz.createdBy.toString() === userId.toString();
      const isInvited = userId && quiz.invitedUsers.includes(userId);
      const isAdmin = req.user?.role === 'admin';
      
      // Sprawdź dostęp przez grupy
      let hasGroupAccess = false;
      if (userId && quiz.groupAccess && quiz.groupAccess.length > 0) {
        const Group = require('../models/Group');
        const userGroups = await Group.find({ 
          _id: { $in: quiz.groupAccess },
          'members.userId': userId 
        });
        hasGroupAccess = userGroups.length > 0;
      }
      
      if (!isOwner && !isInvited && !hasGroupAccess && !isAdmin) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'This quiz is private'
        });
      }
    }

    if (userId) {
      // Increment views atomically and return the updated quiz with populated fields
      quiz = await Quiz.findByIdAndUpdate(
        id, 
        { $inc: { views: 1 } },
        { new: true }
      )
      .populate('questions')
      .populate('category', 'name description')
      .populate('tags', 'name description')
      .exec();
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
      .populate('category', 'name description')
      .populate('tags', 'name description')
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
    const isAdmin = req.user?.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only edit your own quizzes'
      });
    }

    let updateData = { ...req.body, updatedAt: Date.now() };

    if (updateData.category && typeof updateData.category === 'string') {
      let category = await Category.findOne({ name: updateData.category });
      if (!category) {
        category = await Category.create({
          name: updateData.category,
          description: `Category for ${updateData.category}`
        });
      }
      updateData.category = category._id;
    }

    if (Array.isArray(updateData.tags)) {
      const tagIds = [];
      for (const tagName of updateData.tags) {
        let tag = await Tag.findOne({ name: tagName });
        if (!tag) {
          tag = await Tag.create({ 
            name: tagName, 
            description: `Tag for ${tagName}` 
          });
        }
        tagIds.push(tag._id);
      }
      updateData.tags = tagIds;
    }

    const updatedQuiz = await Quiz.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('questions')
     .populate('category', 'name description')
     .populate('tags', 'name description');

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
    const isAdmin = req.user?.role === 'admin';

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
      language,
      tags,
      keywords,
      sortBy = 'views',
      sortOrder = 'desc',
      page = 1,
      limit = 10
    } = req.query;

    const filter = { isActive: true, isPublic: true };

    // Wyszukiwanie główne
    if (q || keywords) {
      const searchTerm = q || keywords;
      const regex = new RegExp(searchTerm, 'i');
      const tagDocs = await Tag.find({ name: regex });
      const tagIds = tagDocs.map(tag => tag._id);
      
      filter.$or = [
        { title: regex },
        { description: regex },
        { tags: { $in: tagIds } }
      ];
    }

    // Filtrowanie kategorii
    if (category) {
      const categoryDoc = await Category.findOne({ name: category });
      if (categoryDoc) {
        filter.category = categoryDoc._id;
      } else {
        return res.json({ total: 0, page: 1, limit: 10, quizzes: [] });
      }
    }

    if (difficulty) filter.difficulty = difficulty;
    if (language) filter.language = language;
    
    // Filtrowanie tagów
    if (tags) {
      const tagNames = tags.split(',').map(tag => tag.trim());
      const tagDocs = await Tag.find({ name: { $in: tagNames } });
      const tagIds = tagDocs.map(tag => tag._id);
      
      if (filter.tags) {
        // Jeśli już mamy tagi z wyszukiwania, użyj AND
        filter.tags = { $all: tagIds };
      } else {
        filter.tags = { $in: tagIds };
      }
    }

    // Sortowanie z domyślnym według popularności
    const sortOptions = {};
    const validSortFields = [
      'createdAt', 'views', 'playCount', 'title', 
      'averageRating', 'lastPlayedAt', 'weeklyPlayCount', 'monthlyPlayCount'
    ];
    
    if (validSortFields.includes(sortBy)) {
      sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
      
      // Domyślne sortowanie według popularności
      if (sortBy === 'views') {
        sortOptions.playCount = -1;
        sortOptions.averageRating = -1;
      } else if (sortBy === 'playCount') {
        sortOptions.views = -1;
        sortOptions.averageRating = -1;
      } else if (sortBy === 'averageRating') {
        sortOptions.ratingCount = -1;
        sortOptions.playCount = -1;
      }
    } else {
      // Domyślnie sortuj według popularności
      sortOptions.views = -1;
      sortOptions.playCount = -1;
      sortOptions.averageRating = -1;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const quizzes = await Quiz.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('category', 'name description')
      .populate('tags', 'name description')
      .select('title description category difficulty language tags playCount views averageRating ratingCount createdAt createdBy lastPlayedAt weeklyPlayCount monthlyPlayCount')
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

    quiz.calculateAverageRating();
    await quiz.save();

    res.json({
      message: 'Rating saved successfully',
      averageRating: quiz.averageRating,
      ratingCount: quiz.ratingCount
    });
  } catch (error) {
    console.error('[rateQuiz] Error:', error);
    res.status(500).json({
      error: 'Failed to save rating',
      details: error.message
    });
  }
};

exports.inviteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    const requesterId = req.user.id;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const quiz = await Quiz.findById(id);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    if (quiz.createdBy !== requesterId) {
      return res.status(403).json({ error: 'Only quiz owner can invite users' });
    }

    if (quiz.invitedUsers.includes(userId)) {
      return res.status(400).json({ error: 'User is already invited' });
    }

    quiz.invitedUsers.push(userId);
    await quiz.save();

    res.status(201).json({
      message: 'User invited successfully',
      invitedUsers: quiz.invitedUsers
    });
  } catch (error) {
    console.error('[inviteUser] Error:', error);
    res.status(500).json({
      error: 'Failed to invite user',
      details: error.message
    });
  }
};

// Usuwanie zaproszenia
exports.removeInvite = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const requesterId = req.user.id;

    const quiz = await Quiz.findById(id);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Sprawdź czy requester jest właścicielem quizu
    if (quiz.createdBy !== requesterId) {
      return res.status(403).json({ error: 'Only quiz owner can remove invites' });
    }

    // Usuń użytkownika z listy zaproszonych
    quiz.invitedUsers = quiz.invitedUsers.filter(invitedUserId => invitedUserId !== userId);
    await quiz.save();

    res.json({
      message: 'Invite removed successfully',
      invitedUsers: quiz.invitedUsers
    });
  } catch (error) {
    console.error('[removeInvite] Error:', error);
    res.status(500).json({
      error: 'Failed to remove invite',
      details: error.message
    });
  }
};

// Pobieranie listy zaproszonych użytkowników
exports.getQuizInvites = async (req, res) => {
  try {
    const { id } = req.params;
    const requesterId = req.user.id;

    const quiz = await Quiz.findById(id).select('invitedUsers createdBy title');
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Sprawdź czy requester jest właścicielem quizu
    if (quiz.createdBy !== requesterId) {
      return res.status(403).json({ error: 'Only quiz owner can view invites' });
    }

    res.json({
      quizId: id,
      quizTitle: quiz.title,
      invitedUsers: quiz.invitedUsers
    });
  } catch (error) {
    console.error('[getQuizInvites] Error:', error);
    res.status(500).json({
      error: 'Failed to get quiz invites',
      details: error.message
    });
  }
};

// Dodawanie grupy do dostępu quiz
exports.addGroupAccess = async (req, res) => {
  try {
    const { id } = req.params;
    const { groupId } = req.body;
    const requesterId = req.user.id;

    if (!groupId) {
      return res.status(400).json({ error: 'Group ID is required' });
    }

    const quiz = await Quiz.findById(id);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Sprawdź czy requester jest właścicielem quizu
    if (quiz.createdBy !== requesterId) {
      return res.status(403).json({ error: 'Only quiz owner can manage group access' });
    }

    // Sprawdź czy grupa istnieje
    const Group = require('../models/Group');
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Sprawdź czy grupa już ma dostęp
    if (quiz.groupAccess.includes(groupId)) {
      return res.status(400).json({ error: 'Group already has access' });
    }

    quiz.groupAccess.push(groupId);
    await quiz.save();

    res.status(201).json({
      message: 'Group access added successfully',
      groupAccess: quiz.groupAccess
    });
  } catch (error) {
    console.error('[addGroupAccess] Error:', error);
    res.status(500).json({
      error: 'Failed to add group access',
      details: error.message
    });
  }
};

// Usuwanie dostępu grupy do quiz
exports.removeGroupAccess = async (req, res) => {
  try {
    const { id, groupId } = req.params;
    const requesterId = req.user.id;

    const quiz = await Quiz.findById(id);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Sprawdź czy requester jest właścicielem quizu
    if (quiz.createdBy !== requesterId) {
      return res.status(403).json({ error: 'Only quiz owner can manage group access' });
    }

    // Usuń grupę z dostępu
    quiz.groupAccess = quiz.groupAccess.filter(gId => gId.toString() !== groupId);
    await quiz.save();

    res.json({
      message: 'Group access removed successfully',
      groupAccess: quiz.groupAccess
    });
  } catch (error) {
    console.error('[removeGroupAccess] Error:', error);
    res.status(500).json({
      error: 'Failed to remove group access',
      details: error.message
    });
  }
};

// Pobieranie grup z dostępem do quiz
exports.getQuizGroupAccess = async (req, res) => {
  try {
    const { id } = req.params;
    const requesterId = req.user.id;

    const quiz = await Quiz.findById(id).populate('groupAccess', 'name description').select('groupAccess createdBy title');
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Sprawdź czy requester jest właścicielem quizu
    if (quiz.createdBy !== requesterId) {
      return res.status(403).json({ error: 'Only quiz owner can view group access' });
    }

    res.json({
      quizId: id,
      quizTitle: quiz.title,
      groupAccess: quiz.groupAccess
    });
  } catch (error) {
    console.error('[getQuizGroupAccess] Error:', error);
    res.status(500).json({
      error: 'Failed to get quiz group access',
      details: error.message
    });
  }
};

// Nowa funkcja do aktualizacji statystyk quiz po zakończeniu gry
exports.incrementPlayCount = async (req, res) => {
  try {
    const { id } = req.params;
    
    const quiz = await Quiz.findById(id);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    quiz.playCount = (quiz.playCount || 0) + 1;
    quiz.lastPlayedAt = new Date();
    
    // Zaktualizuj tygodniowy i miesięczny licznik (uproszczona implementacja)
    quiz.weeklyPlayCount = (quiz.weeklyPlayCount || 0) + 1;
    quiz.monthlyPlayCount = (quiz.monthlyPlayCount || 0) + 1;
    
    await quiz.save();

    res.json({
      message: 'Play count updated',
      playCount: quiz.playCount
    });
  } catch (error) {
    console.error('[incrementPlayCount] Error:', error);
    res.status(500).json({
      error: 'Failed to update play count',
      details: error.message
    });
  }
}; 