const Category = require('../models/Category');

exports.createCategory = async (req, res) => {
  try {
    const category = new Category(req.body);
    await category.save();
    res.status(201).json({
      message: 'Category created successfully',
      category
    });
  } catch (error) {
    console.error('[createCategory] Error:', error);
    res.status(400).json({ 
      error: 'Failed to create category', 
      details: error.message 
    });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const { includeInactive = false } = req.query;
    
    const filter = includeInactive === 'true' ? {} : { isActive: true };
    
    const categories = await Category.find(filter)
      .populate('parent', 'name description')
      .sort({ name: 1 });
      
    res.json(categories);
  } catch (error) {
    console.error('[getCategories] Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch categories', 
      details: error.message 
    });
  }
};

exports.getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
      .populate('parent', 'name description');
      
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    res.json(category);
  } catch (error) {
    console.error('[getCategoryById] Error:', error);
    res.status(400).json({ 
      error: 'Invalid category ID', 
      details: error.message 
    });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true, runValidators: true }
    ).populate('parent', 'name description');
    
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    res.json({
      message: 'Category updated successfully',
      category
    });
  } catch (error) {
    console.error('[updateCategory] Error:', error);
    res.status(400).json({ 
      error: 'Failed to update category', 
      details: error.message 
    });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('[deleteCategory] Error:', error);
    res.status(400).json({ 
      error: 'Failed to delete category', 
      details: error.message 
    });
  }
};

exports.getCategoryHierarchy = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .populate('parent', 'name')
      .sort({ name: 1 });

    // Budowanie hierarchii
    const hierarchy = categories.filter(cat => !cat.parent);
    const children = categories.filter(cat => cat.parent);

    const buildHierarchy = (parent) => {
      const childCategories = children.filter(child => 
        child.parent._id.toString() === parent._id.toString()
      );
      
      if (childCategories.length > 0) {
        parent.children = childCategories.map(child => buildHierarchy(child));
      }
      
      return parent;
    };

    const result = hierarchy.map(parent => buildHierarchy(parent));
    
    res.json(result);
  } catch (error) {
    console.error('[getCategoryHierarchy] Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch category hierarchy', 
      details: error.message 
    });
  }
}; 