const express = require('express');
const path = require('path');
const cors = require('cors');
const { connectDB } = require('./config/db');
const { initData } = require('./services/dataStore');

const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
let PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static assets
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/admin', adminRoutes);

// Frontend Routes (/omakase/...)
app.get(['/', '/omakase', '/omakase/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/omakase/stories', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'stories.html'));
});

app.get('/omakase/story/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'story.html'));
});

app.get('/omakase/chapter/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chapter.html'));
});

app.get('/omakase/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

app.get([
  '/omakase/admin/dashboard',
  '/omakase/admin/story/edit/:id',
  '/omakase/admin/story/detail/:id',
  '/omakase/admin/chapter/edit/:id'
], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});

// Fallback for sub-routes under omakase
app.get('/omakase/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server with automatic port retry if port is busy
async function listenWithFallback(portToUse) {
  const server = app.listen(portToUse, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Omasake Site123 Server is running!`);
    console.log(`🌐 Website Frontend URL : http://localhost:${portToUse}/omakase/`);
    console.log(`🔑 Admin Login URL     : http://localhost:${portToUse}/omakase/admin/login`);
    console.log(`📊 Admin Dashboard URL : http://localhost:${portToUse}/omakase/admin/dashboard`);
    console.log(`📡 User API Base Path  : http://localhost:${portToUse}/api/v1/user/...`);
    console.log(`🔐 Admin API Base Path : http://localhost:${portToUse}/api/v1/admin/...`);
    console.log(`=======================================================`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Cổng ${portToUse} đã bận. Đang chuyển sang cổng ${portToUse + 1}...`);
      listenWithFallback(portToUse + 1);
    } else {
      console.error('Lỗi server:', err);
    }
  });
}

async function startServer() {
  await connectDB();
  await initData();
  await listenWithFallback(PORT);
}

startServer();
