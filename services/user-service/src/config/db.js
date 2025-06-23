const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
console.log('Prisma client: initialized successfully');
module.exports = { prisma }; 