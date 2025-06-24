// Test setup for Jest
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/quiz_test_db';

// Zwiększ timeout dla testów bazy danych
jest.setTimeout(30000); 