const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from atlas-credentials.env if present
const atlasEnvPath = path.join(__dirname, '..', 'atlas-credentials.env');
if (fs.existsSync(atlasEnvPath)) {
  dotenv.config({ path: atlasEnvPath });
} else {
  dotenv.config();
}

const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

let isUsingMemoryFallback = false;

const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI) {
    console.warn('MONGODB_URI is not configured. Running with local storage mode active.');
    isUsingMemoryFallback = true;
    return;
  }

  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000 // 5 sec timeout fallback
    });
    console.log('MongoDB Atlas Connected Successfully.');
  } catch (err) {
    console.warn('MongoDB Atlas connection error/timeout:', err.message);
    console.warn('Running with local storage mode active.');
    isUsingMemoryFallback = true;
  }
};

module.exports = { connectDB, getIsMemoryFallback: () => isUsingMemoryFallback };
