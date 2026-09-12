const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  siteTitle: {
    type: String,
    default: 'Omasake'
  },
  heroTitle: {
    type: String,
    default: 'JimmySea - Avocean'
  },
  heroSubtitle: {
    type: String,
    default: 'Chữa lành cùng gia đình vợ chồng già'
  },
  logoUrl: {
    type: String,
    default: 'https://files.cdn-files-a.com/uploads/12065718/400_69f17ca68bc4f.png'
  },
  headerBannerUrl: {
    type: String,
    default: 'https://files.cdn-files-a.com/uploads/12065718/2000_69f18eadc4f57.jpg'
  },
  footerBgUrl: {
    type: String,
    default: 'https://files.cdn-files-a.com/uploads/12065718/secure/2000_69f18f459e85b.jpg'
  },
  facebookUrl: {
    type: String,
    default: 'https://www.facebook.com/profile.php?id=61577359593140&locale=vi_VN'
  },
  announcementText: {
    type: String,
    default: '✨ Chào mừng bạn đến với Omasake - Chữa lành cùng gia đình vợ chồng già 💚'
  },
  announcementLink: {
    type: String,
    default: '#'
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Settings', settingsSchema);
