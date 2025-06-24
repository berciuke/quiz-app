const app = require('./app');
const { connectDB } = require('./config/db');

const port = process.env.PORT || 3003;

// Łączenie z bazą danych tylko gdy nie jesteśmy w środowisku testowym
if (process.env.NODE_ENV !== 'test') {
  connectDB();
}

app.listen(port, () => {
  console.log(`Quiz-service listening on port ${port}`);
});

module.exports = app; 