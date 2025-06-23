const request = require('supertest');
const app = require('../src/index.js');

describe('GET /health', () => {
  it('should return 200 and ok status', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
}); 