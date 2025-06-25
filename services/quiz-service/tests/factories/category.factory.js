const Category = require('../../src/models/Category');

const createCategoryData = (overrides = {}) => ({
  name: `Test Category ${Date.now()}`,
  description: 'Test category description',
  isActive: true,
  ...overrides
});

const createCategory = async (overrides = {}) => {
  const categoryData = createCategoryData(overrides);
  return await Category.create(categoryData);
};

const createCategoryWithChildren = async (parentOverrides = {}, childrenCount = 2) => {
  const parent = await createCategory(parentOverrides);
  const children = [];
  
  for (let i = 0; i < childrenCount; i++) {
    const child = await createCategory({
      parent: parent._id,
      name: `${parent.name} - ${faker.commerce.productName()}`
    });
    children.push(child);
  }
  
  return { parent, children };
};

module.exports = {
  createCategoryData,
  createCategory,
  createCategoryWithChildren
}; 