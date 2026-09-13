const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const Settings = require('../models/Settings');
const Story = require('../models/Story');
const Chapter = require('../models/Chapter');

const LOCAL_DB_FILE = path.join(__dirname, '..', 'local_db.json');

// In-memory fallback data store if MongoDB Atlas is unreachable
let inMemoryDb = {
  admin: null,
  admins: [],
  settings: {
    _id: 'default_settings_id',
    siteTitle: 'Omasake',
    heroTitle: 'JimmySea - Avocean',
    heroSubtitle: 'Chữa lành cùng gia đình vợ chồng già',
    logoUrl: 'https://files.cdn-files-a.com/uploads/12065718/400_69f17ca68bc4f.png',
    headerBannerUrl: 'https://files.cdn-files-a.com/uploads/12065718/2000_69f18eadc4f57.jpg',
    footerBgUrl: 'https://files.cdn-files-a.com/uploads/12065718/secure/2000_69f18f459e85b.jpg',
    facebookUrl: 'https://www.facebook.com/profile.php?id=61577359593140&locale=vi_VN',
    announcementText: '✨ Chào mừng bạn đến với Omasake - Chữa lành cùng gia đình vợ chồng già 💚',
    announcementLink: '#',
    updatedAt: new Date()
  },
  stories: [
    {
      _id: 'story_1',
      title: 'Hoàng Hôn Cuối Cùng',
      coverUrl: 'https://files.cdn-files-a.com/uploads/12065718/2000_69f18eadc4f57.jpg',
      author: 'JimmySea - Avocean',
      status: 'Đang tiến hành',
      genres: ['Chữa Lành', 'Tình Cảm', 'Đời Thường'],
      description: 'Hoàng hôn cuối cùng - Bộ truyện chữa lành cùng gia đình vợ chồng già JimmySea & Avocean. Từng trang truyện là những khoảnh khắc ấm áp và bình yên nhất.',
      views: 1840,
      createdBy: 'admin',
      updatedBy: 'admin',
      createdAt: new Date(Date.now() - 7 * 86400000),
      updatedAt: new Date()
    },
    {
      _id: 'story_2',
      title: 'Nhật Ký Gia Đình Nhỏ Omasake',
      coverUrl: 'https://files.cdn-files-a.com/uploads/12065718/400_69f17ca68bc4f.png',
      author: 'Avocean Team',
      status: 'Hoàn thành',
      genres: ['Chữa Lành', 'Gia Đình'],
      description: 'Những mẩu chuyện thường nhật tràn ngập tiếng cười và sự quan tâm sâu sắc.',
      views: 1120,
      createdBy: 'admin',
      updatedBy: 'admin',
      createdAt: new Date(Date.now() - 14 * 86400000),
      updatedAt: new Date()
    }
  ],
  chapters: [
    {
      _id: 'chap_1_1',
      storyId: 'story_1',
      chapterNumber: 1,
      title: 'Chương 1: Ánh Hoàng Hôn Ấm Áp',
      content: `Ánh hoàng hôn buông xuống trên mái nhà nhỏ. Tiếng tách trà nóng nghi ngút khói hòa quyện cùng tiếng cười rộn rã.

![Gia đình Omasake](https://files.cdn-files-a.com/uploads/12065718/2000_69f18eadc4f57.jpg)

"Những điều giản dị nhất đôi khi lại chính là ngọn lửa ấm áp nhất chữa lành mọi vết thương trong lòng..."`,
      views: 620,
      createdBy: 'admin',
      updatedBy: 'admin',
      createdAt: new Date(Date.now() - 7 * 86400000),
      updatedAt: new Date()
    },
    {
      _id: 'chap_1_2',
      storyId: 'story_1',
      chapterNumber: 2,
      title: 'Chương 2: Tách Trà Buổi Chiều',
      content: `Tách trà thơm ngọt ngào mang vị thảo mộc thiên nhiên...

![Gia đình Omasake](https://files.cdn-files-a.com/uploads/12065718/400_69f17ca68bc4f.png)

Mỗi ngày trôi qua tại Omasake luôn tràn ngập yêu thương.`,
      views: 480,
      createdBy: 'admin',
      updatedBy: 'admin',
      createdAt: new Date(Date.now() - 5 * 86400000),
      updatedAt: new Date()
    }
  ]
};

function saveInMemoryDb() {
  try {
    fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(inMemoryDb, null, 2), 'utf8');
  } catch (err) {
    console.warn('Cannot persist local_db.json:', err.message);
  }
}

async function initData() {
  const isDbConnected = mongoose.connection.readyState === 1;

  // Load from local_db.json if available
  if (fs.existsSync(LOCAL_DB_FILE)) {
    try {
      const raw = fs.readFileSync(LOCAL_DB_FILE, 'utf8');
      const loaded = JSON.parse(raw);
      if (loaded && typeof loaded === 'object') {
        if (loaded.admin) inMemoryDb.admin = loaded.admin;
        if (Array.isArray(loaded.admins)) inMemoryDb.admins = loaded.admins;
        if (loaded.settings) inMemoryDb.settings = loaded.settings;
        if (Array.isArray(loaded.stories)) inMemoryDb.stories = loaded.stories;
        if (Array.isArray(loaded.chapters)) inMemoryDb.chapters = loaded.chapters;
        console.log('Loaded local database from local_db.json successfully.');
      }
    } catch (e) {
      console.warn('Could not parse local_db.json, using default seed:', e.message);
    }
  }

  // Ensure default admin exists if empty
  if (!inMemoryDb.admin || !inMemoryDb.admins || inMemoryDb.admins.length === 0) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const defaultAdmin = {
      _id: 'admin_1',
      username: 'admin',
      password: hashedPassword,
      role: 'ADMIN',
      createdBy: 'system',
      updatedBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    inMemoryDb.admin = defaultAdmin;
    inMemoryDb.admins = [defaultAdmin];
  }

  // Save state to local_db.json
  saveInMemoryDb();

  if (isDbConnected) {
    try {
      const existingAdmin = await Admin.findOne({ username: 'admin' });
      if (!existingAdmin) {
        await Admin.create({
          username: 'admin',
          password: inMemoryDb.admin.password,
          role: 'ADMIN',
          createdBy: 'system',
          updatedBy: 'system'
        });
        console.log('Default admin seeded to MongoDB');
      }

      const existingSettings = await Settings.findOne();
      if (!existingSettings) {
        await Settings.create(inMemoryDb.settings);
        console.log('Default Site123 settings seeded to MongoDB');
      }

      const count = await Story.countDocuments();
      if (count === 0) {
        const createdStories = await Story.insertMany(inMemoryDb.stories);
        if (createdStories.length > 0) {
          await Chapter.insertMany([
            {
              storyId: createdStories[0]._id,
              chapterNumber: 1,
              title: 'Chương 1: Ánh Hoàng Hôn Ấm Áp',
              content: inMemoryDb.chapters[0].content,
              views: 620,
              createdBy: 'admin',
              updatedBy: 'admin'
            },
            {
              storyId: createdStories[0]._id,
              chapterNumber: 2,
              title: 'Chương 2: Tách Trà Buổi Chiều',
              content: inMemoryDb.chapters[1].content,
              views: 480,
              createdBy: 'admin',
              updatedBy: 'admin'
            }
          ]);
        }
        console.log('Sample Site123 stories and chapters seeded to MongoDB');
      }
    } catch (e) {
      console.warn('DB Seeding warning:', e.message);
    }
  }
}

module.exports = {
  inMemoryDb,
  saveInMemoryDb,
  initData
};

