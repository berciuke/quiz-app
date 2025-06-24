const { faker } = require('@faker-js/faker');
const Tag = require('../../src/models/Tag');

const createTagData = (overrides = {}) => ({
  name: faker.lorem.word(),
  description: faker.lorem.sentence(),
  isActive: true,
  ...overrides
});

const createTag = async (overrides = {}) => {
  const tagData = createTagData(overrides);
  return await Tag.create(tagData);
};

const createMultipleTags = async (count = 3, baseOverrides = {}) => {
  const tags = [];
  for (let i = 0; i < count; i++) {
    const tag = await createTag({
      ...baseOverrides,
      name: `${baseOverrides.name || 'tag'}-${i + 1}`
    });
    tags.push(tag);
  }
  return tags;
};

module.exports = {
  createTagData,
  createTag,
  createMultipleTags
}; 