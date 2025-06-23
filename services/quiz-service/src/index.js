const express = require('express');

const app = express();
const port = process.env.PORT || 3003;

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Quiz-service listening on port ${port}`);
});

module.exports = app; 