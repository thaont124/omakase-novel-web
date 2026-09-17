const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const dns = require('dns');

// Configure Google DNS fallback for Windows SRV lookup
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

// Load environment variables (.env first)
dotenv.config();
const atlasEnvPath = path.join(__dirname, '..', 'atlas-credentials.env');
if (fs.existsSync(atlasEnvPath)) {
  dotenv.config({ path: atlasEnvPath });
}

const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI) {
    console.error('ERROR: MONGODB_URI environment variable is missing.');
    process.exit(1);
  }

  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(mongoURI, {
      maxPoolSize: 2,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });
    console.log('MongoDB Atlas Connected Successfully.');
  } catch (err) {
    console.error('MongoDB Atlas Connection Error:', err.message);
    process.exit(1);
  }
};

module.exports = { connectDB };
