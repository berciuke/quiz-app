const express = require('express');

const app = express();
const port = process.env.PORT || 3002;

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`User-service listening on port ${port}`);
});

module.exports = app; 