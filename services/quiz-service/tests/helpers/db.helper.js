const mongoose = require('mongoose');

const clearCollections = async (...collectionNames) => {
  const collections = mongoose.connection.collections;
  
  if (collectionNames.length === 0) {
    // Clear all collections
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  } else {
    // Clear specific collections
    for (const name of collectionNames) {
      if (collections[name]) {
        await collections[name].deleteMany({});
      }
    }
  }
};

const getCollectionCounts = async () => {
  const collections = mongoose.connection.collections;
  const counts = {};
  
  for (const [name, collection] of Object.entries(collections)) {
    counts[name] = await collection.countDocuments();
  }
  
  return counts;
};

module.exports = {
  clearCollections,
  getCollectionCounts
}; 