const originalExit = process.exit;

beforeAll(() => {
  process.exit = jest.fn();
});

afterAll(() => {
  process.exit = originalExit;
}); 