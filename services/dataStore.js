const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const Settings = require('../models/Settings');
const Story = require('../models/Story');
const Chapter = require('../models/Chapter');

const defaultSettings = {
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
};

const defaultStories = [
  {
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
];

async function initData() {
  try {
    const existingAdmin = await Admin.findOne({ username: 'admin' });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await Admin.create({
        username: 'admin',
        password: hashedPassword,
        role: 'ADMIN',
        createdBy: 'system',
        updatedBy: 'system'
      });
      console.log('Default admin seeded to MongoDB (admin / admin123)');
    }

    const existingSettings = await Settings.findOne();
    if (!existingSettings) {
      await Settings.create(defaultSettings);
      console.log('Default Site123 settings seeded to MongoDB');
    }

    const count = await Story.countDocuments();
    if (count === 0) {
      const createdStories = await Story.insertMany(defaultStories);
      if (createdStories.length > 0) {
        await Chapter.insertMany([
          {
            storyId: createdStories[0]._id,
            chapterNumber: 1,
            title: 'Chương 1: Ánh Hoàng Hôn Ấm Áp',
            content: `Ánh hoàng hôn buông xuống trên mái nhà nhỏ. Tiếng tách trà nóng nghi ngút khói hòa quyện cùng tiếng cười rộn rã.\n\n![Gia đình Omasake](https://files.cdn-files-a.com/uploads/12065718/2000_69f18eadc4f57.jpg)\n\n"Những điều giản dị nhất đôi khi lại chính là ngọn lửa ấm áp nhất chữa lành mọi vết thương trong lòng..."`,
            views: 620,
            createdBy: 'admin',
            updatedBy: 'admin'
          },
          {
            storyId: createdStories[0]._id,
            chapterNumber: 2,
            title: 'Chương 2: Tách Trà Buổi Chiều',
            content: `Tách trà thơm ngọt ngào mang vị thảo mộc thiên nhiên...\n\n![Gia đình Omasake](https://files.cdn-files-a.com/uploads/12065718/400_69f17ca68bc4f.png)\n\nMỗi ngày trôi qua tại Omasake luôn tràn ngập yêu thương.`,
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

module.exports = {
  initData
};
