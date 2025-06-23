const request = require('supertest');
const app = require('../src/index');

describe('Health Check', () => {
  it('should return health status', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('quiz-service');
    expect(response.body.timestamp).toBeDefined();
  });

  it('should return 404 for unknown routes', async () => {
    await request(app)
      .get('/unknown-route')
      .expect(404);
  });
}); 