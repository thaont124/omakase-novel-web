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
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '3mb' }));
app.use(express.urlencoded({ extended: true, limit: '3mb' }));

// Serve static assets with cache headers
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  etag: true
}));

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

const Story = require('./models/Story');
const Chapter = require('./models/Chapter');
const { startViewFlusher } = require('./services/cacheService');

// Start server listening on 0.0.0.0 for cloud platform compatibility
async function startServer() {
  try {
    await connectDB();
    await initData();
    startViewFlusher(Story, Chapter);

    const isProduction = process.env.NODE_ENV === 'production' || process.env.PORT;
    const host = '0.0.0.0';

    const server = app.listen(PORT, host, () => {
      console.log(`=======================================================`);
      console.log(`🚀 Omasake Site123 Server running on ${host}:${PORT}`);
      console.log(`🌐 Website Frontend URL : http://localhost:${PORT}/omakase/`);
      console.log(`=======================================================`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE' && !process.env.PORT) {
        console.warn(`Cổng ${PORT} đã bận. Đang thử cổng ${Number(PORT) + 1}...`);
        app.listen(Number(PORT) + 1, host);
      } else {
        console.error('Lỗi server:', err);
      }
    });
  } catch (err) {
    console.error('Không thể khởi động server:', err);
    process.exit(1);
  }
}

startServer();
