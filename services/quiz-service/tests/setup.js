const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.test' });

let mongoServer;

// Global setup
beforeAll(async () => {
  // Disconnect any existing connections
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  
  // Start MongoDB Memory Server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Connect mongoose
  await mongoose.connect(mongoUri);
  console.log('🧪 Test MongoDB connected');
});

// Global cleanup
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  console.log('🧹 Test MongoDB disconnected');
});

// Clean between tests
beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// Increase Jest timeout
jest.setTimeout(30000); 