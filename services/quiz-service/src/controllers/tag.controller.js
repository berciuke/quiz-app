const Tag = require('../models/Tag');

exports.createTag = async (req, res) => {
  try {
    const tag = new Tag(req.body);
    await tag.save();
    res.status(201).json({
      message: 'Tag created successfully',
      tag
    });
  } catch (error) {
    console.error('[createTag] Error:', error);
    res.status(400).json({ 
      error: 'Failed to create tag', 
      details: error.message 
    });
  }
};

exports.getTags = async (req, res) => {
  try {
    const { 
      includeInactive = false, 
      search,
      page = 1,
      limit = 50
    } = req.query;
    
    const filter = includeInactive === 'true' ? {} : { isActive: true };
    
    if (search) {
      const regex = new RegExp(search, 'i');
      filter.name = regex;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const tags = await Tag.find(filter)
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Tag.countDocuments(filter);
      
    res.json({
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      tags
    });
  } catch (error) {
    console.error('[getTags] Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch tags', 
      details: error.message 
    });
  }
};

exports.getTagById = async (req, res) => {
  try {
    const tag = await Tag.findById(req.params.id);
      
    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }
    
    res.json(tag);
  } catch (error) {
    console.error('[getTagById] Error:', error);
    res.status(400).json({ 
      error: 'Invalid tag ID', 
      details: error.message 
    });
  }
};

exports.updateTag = async (req, res) => {
  try {
    const tag = await Tag.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true, runValidators: true }
    );
    
    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }
    
    res.json({
      message: 'Tag updated successfully',
      tag
    });
  } catch (error) {
    console.error('[updateTag] Error:', error);
    res.status(400).json({ 
      error: 'Failed to update tag', 
      details: error.message 
    });
  }
};

exports.deleteTag = async (req, res) => {
  try {
    const tag = await Tag.findByIdAndDelete(req.params.id);
    
    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }
    
    res.json({ message: 'Tag deleted successfully' });
  } catch (error) {
    console.error('[deleteTag] Error:', error);
    res.status(400).json({ 
      error: 'Failed to delete tag', 
      details: error.message 
    });
  }
};

exports.getPopularTags = async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    
    const popularTags = await Tag.aggregate([
      { $match: { isActive: true } },
      {
        $lookup: {
          from: 'quizzes',
          localField: '_id',
          foreignField: 'tags',
          as: 'quizzes'
        }
      },
      {
        $project: {
          name: 1,
          description: 1,
          usageCount: { $size: '$quizzes' }
        }
      },
      { $sort: { usageCount: -1 } },
      { $limit: parseInt(limit) }
    ]);
    
    res.json(popularTags);
  } catch (error) {
    console.error('[getPopularTags] Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch popular tags', 
      details: error.message 
    });
  }
}; 