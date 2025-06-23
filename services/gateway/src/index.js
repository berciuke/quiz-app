const express = require('express');

const app = express();
const port = process.env.PORT || 3001;

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Gateway listening on port ${port}`);
});

module.exports = app; 