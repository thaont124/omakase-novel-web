const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const Admin = require('../models/Admin');
const Settings = require('../models/Settings');
const Story = require('../models/Story');
const Chapter = require('../models/Chapter');
const { verifyAdminToken, JWT_SECRET } = require('../middleware/auth');
const { inMemoryDb, saveInMemoryDb } = require('../services/dataStore');

const isDbConnected = () => mongoose.connection.readyState === 1;

// Helper to convert Markdown image tags or image URLs in content into rendered HTML <img>
function parseContentToHtml(content) {
  if (!content) return '';

  let html = content;

  // Convert markdown image ![alt](url) to HTML <img src="url" alt="alt" class="chapter-img" />
  html = html.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, url) => {
    return `<div class="img-wrapper"><img src="${url.trim()}" alt="${alt || 'HÌnh ảnh minh họa'}" class="chapter-img" loading="lazy" /><span class="img-caption">${alt || ''}</span></div>`;
  });

  // Convert standalone image URLs on their own line into <img> elements
  const lines = html.split('\n');
  const processedLines = lines.map(line => {
    const trimmed = line.trim();
    if (trimmed.match(/^https?:\/\/.+\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i)) {
      return `<div class="img-wrapper"><img src="${trimmed}" alt="Hình ảnh minh họa" class="chapter-img" loading="lazy" /></div>`;
    }
    if (trimmed.startsWith('<div class="img-wrapper">')) {
      return trimmed;
    }
    return trimmed ? `<p>${trimmed}</p>` : '';
  });

  return processedLines.join('\n');
}

// -------------------------------------------------------------
// PUBLIC ADMIN AUTH ROUTES
// -------------------------------------------------------------

// POST /api/v1/admin/auth/login
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.' });
    }

    let adminUser = null;

    if (isDbConnected()) {
      adminUser = await Admin.findOne({ username });
    }
    
    if (!adminUser) {
      adminUser = (inMemoryDb.admins || []).find(a => a.username === username);
      if (!adminUser && inMemoryDb.admin && inMemoryDb.admin.username === username) {
        adminUser = inMemoryDb.admin;
      }
    }

    if (!adminUser) {
      return res.status(401).json({ success: false, message: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
    }

    const isMatch = await bcrypt.compare(password, adminUser.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
    }

    const token = jwt.sign(
      { id: adminUser._id, username: adminUser.username, role: 'ADMIN' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      message: 'Đăng nhập Admin thành công!',
      token,
      admin: {
        username: adminUser.username,
        role: 'ADMIN'
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/admin/auth/me
router.get('/auth/me', verifyAdminToken, (req, res) => {
  return res.json({
    success: true,
    admin: req.admin
  });
});

// POST /api/v1/admin/auth/logout
router.post('/auth/logout', verifyAdminToken, (req, res) => {
  return res.json({
    success: true,
    message: 'Đã đăng xuất tài khoản Admin.'
  });
});

// -------------------------------------------------------------
// PROTECTED ADMIN ROUTES (Require Admin Token)
// -------------------------------------------------------------

// GET /api/v1/admin/settings
router.get('/settings', verifyAdminToken, async (req, res) => {
  try {
    if (isDbConnected()) {
      let settings = await Settings.findOne();
      if (!settings) {
        settings = await Settings.create(inMemoryDb.settings);
      }
      return res.json({ success: true, data: settings });
    } else {
      return res.json({ success: true, data: inMemoryDb.settings });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/v1/admin/settings - Update site UI image URLs & titles
router.put('/settings', verifyAdminToken, async (req, res) => {
  try {
    const { logoUrl, headerBannerUrl, footerBgUrl, facebookUrl, announcementText, announcementLink, siteTitle, heroTitle, heroSubtitle } = req.body;

    const updateFields = {};
    if (logoUrl !== undefined) updateFields.logoUrl = logoUrl;
    if (headerBannerUrl !== undefined) updateFields.headerBannerUrl = headerBannerUrl;
    if (footerBgUrl !== undefined) updateFields.footerBgUrl = footerBgUrl;
    if (facebookUrl !== undefined) updateFields.facebookUrl = facebookUrl;
    if (announcementText !== undefined) updateFields.announcementText = announcementText;
    if (announcementLink !== undefined) updateFields.announcementLink = announcementLink;
    if (siteTitle !== undefined) updateFields.siteTitle = siteTitle;
    if (heroTitle !== undefined) updateFields.heroTitle = heroTitle;
    if (heroSubtitle !== undefined) updateFields.heroSubtitle = heroSubtitle;
    updateFields.updatedAt = new Date();

    if (isDbConnected()) {
      let settings = await Settings.findOne();
      if (!settings) {
        settings = new Settings(updateFields);
      } else {
        Object.assign(settings, updateFields);
      }
      await settings.save();
      return res.json({ success: true, message: 'Đã cập nhật giao diện Site123 thành công!', data: settings });
    } else {
      Object.assign(inMemoryDb.settings, updateFields);
      saveInMemoryDb();
      return res.json({ success: true, message: 'Đã cập nhật giao diện Site123 thành công!', data: inMemoryDb.settings });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/admin/stories - Get all stories for admin
router.get('/stories', verifyAdminToken, async (req, res) => {
  try {
    if (isDbConnected()) {
      const stories = await Story.find().sort({ updatedAt: -1 });
      return res.json({ success: true, data: stories });
    } else {
      return res.json({ success: true, data: inMemoryDb.stories });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/admin/stories - Create new story (cover image URL linked)
router.post('/stories', verifyAdminToken, async (req, res) => {
  try {
    const { title, coverUrl, author, status, genres, description } = req.body;
    const adminUser = req.admin ? req.admin.username : 'admin';

    if (!title) {
      return res.status(400).json({ success: false, message: 'Tên truyện là bắt buộc.' });
    }

    const storyData = {
      title,
      coverUrl: coverUrl || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=400&q=80',
      author: author || 'Tác giả Omakase',
      status: status || 'Đang tiến hành',
      genres: Array.isArray(genres) ? genres : (genres ? genres.split(',').map(g => g.trim()) : ['Khác']),
      description: description || '',
      createdBy: adminUser,
      updatedBy: adminUser,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (isDbConnected()) {
      const newStory = await Story.create(storyData);
      return res.status(201).json({ success: true, message: 'Thêm truyện thành công!', data: newStory });
    } else {
      const newStory = {
        _id: 'story_' + Date.now(),
        ...storyData,
        views: 0
      };
      inMemoryDb.stories.unshift(newStory);
      saveInMemoryDb();
      return res.status(201).json({ success: true, message: 'Thêm truyện thành công!', data: newStory });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/v1/admin/stories/:id - Edit story
router.put('/stories/:id', verifyAdminToken, async (req, res) => {
  try {
    const storyId = req.params.id;
    const { title, coverUrl, author, status, genres, description } = req.body;
    const adminUser = req.admin ? req.admin.username : 'admin';

    if (isDbConnected() && mongoose.Types.ObjectId.isValid(storyId)) {
      const story = await Story.findById(storyId);
      if (!story) return res.status(404).json({ success: false, message: 'Không tìm thấy truyện.' });

      if (title) story.title = title;
      if (coverUrl !== undefined) story.coverUrl = coverUrl;
      if (author !== undefined) story.author = author;
      if (status !== undefined) story.status = status;
      if (genres !== undefined) story.genres = Array.isArray(genres) ? genres : genres.split(',').map(g => g.trim());
      if (description !== undefined) story.description = description;
      story.updatedBy = adminUser;
      story.updatedAt = new Date();

      await story.save();
      return res.json({ success: true, message: 'Cập nhật truyện thành công!', data: story });
    } else {
      const index = inMemoryDb.stories.findIndex(s => String(s._id) === String(storyId));
      if (index === -1) return res.status(404).json({ success: false, message: 'Không tìm thấy truyện.' });

      const story = inMemoryDb.stories[index];
      if (title) story.title = title;
      if (coverUrl !== undefined) story.coverUrl = coverUrl;
      if (author !== undefined) story.author = author;
      if (status !== undefined) story.status = status;
      if (genres !== undefined) story.genres = Array.isArray(genres) ? genres : genres.split(',').map(g => g.trim());
      if (description !== undefined) story.description = description;
      story.updatedBy = adminUser;
      story.updatedAt = new Date();
      saveInMemoryDb();

      return res.json({ success: true, message: 'Cập nhật truyện thành công!', data: story });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/v1/admin/stories/:id - Delete story & its chapters
router.delete('/stories/:id', verifyAdminToken, async (req, res) => {
  try {
    const storyId = req.params.id;

    if (isDbConnected() && mongoose.Types.ObjectId.isValid(storyId)) {
      await Story.findByIdAndDelete(storyId);
      await Chapter.deleteMany({ storyId });
      return res.json({ success: true, message: 'Đã xóa truyện và các chương liên quan.' });
    } else {
      inMemoryDb.stories = inMemoryDb.stories.filter(s => String(s._id) !== String(storyId));
      inMemoryDb.chapters = inMemoryDb.chapters.filter(c => String(c.storyId) !== String(storyId));
      saveInMemoryDb();
      return res.json({ success: true, message: 'Đã xóa truyện và các chương liên quan.' });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/admin/stories/:storyId/chapters - Get chapters for a story
router.get('/stories/:storyId/chapters', verifyAdminToken, async (req, res) => {
  try {
    const storyId = req.params.storyId;

    if (isDbConnected() && mongoose.Types.ObjectId.isValid(storyId)) {
      const chapters = await Chapter.find({ storyId }).sort({ chapterNumber: 1 });
      return res.json({ success: true, data: chapters });
    } else {
      const chapters = inMemoryDb.chapters
        .filter(c => String(c.storyId) === String(storyId))
        .sort((a, b) => a.chapterNumber - b.chapterNumber);
      return res.json({ success: true, data: chapters });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/admin/chapters/:id - Get single chapter detail for editing
router.get('/chapters/:id', verifyAdminToken, async (req, res) => {
  try {
    const chapId = req.params.id;

    if (isDbConnected() && mongoose.Types.ObjectId.isValid(chapId)) {
      const chap = await Chapter.findById(chapId);
      if (!chap) return res.status(404).json({ success: false, message: 'Không tìm thấy chương.' });
      return res.json({ success: true, data: chap });
    } else {
      const chap = inMemoryDb.chapters.find(c => String(c._id) === String(chapId));
      if (!chap) return res.status(404).json({ success: false, message: 'Không tìm thấy chương.' });
      return res.json({ success: true, data: chap });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/admin/chapters - Add new chapter
router.post('/chapters', verifyAdminToken, async (req, res) => {
  try {
    const { storyId, chapterNumber, title, content, publishedAt } = req.body;
    const adminUser = req.admin ? req.admin.username : 'admin';

    if (!storyId || !title || !content) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin chương (truyện, số chương, tiêu đề, nội dung).' });
    }

    const chapNum = Number(chapterNumber) || 1;
    let publishDate = new Date();
    if (publishedAt) {
      const parsedDate = new Date(publishedAt);
      if (!isNaN(parsedDate.getTime())) {
        publishDate = parsedDate;
      }
    }

    const isScheduled = publishDate > new Date();
    const successMsg = isScheduled
      ? `⏰ Đã đặt lịch đăng chương #${chapNum} tự động vào lúc ${publishDate.toLocaleString('vi-VN')}`
      : '🎉 Đăng chương thành công!';

    if (isDbConnected() && mongoose.Types.ObjectId.isValid(storyId)) {
      const existingChap = await Chapter.findOne({ storyId, chapterNumber: chapNum });
      if (existingChap) {
        return res.status(400).json({ success: false, message: `Chương ${chapNum} đã tồn tại trong truyện này. Vui lòng chọn số chương khác.` });
      }

      const newChap = await Chapter.create({
        storyId,
        chapterNumber: chapNum,
        title,
        content,
        publishedAt: publishDate,
        createdBy: adminUser,
        updatedBy: adminUser
      });

      // Update story updatedAt & updatedBy
      await Story.findByIdAndUpdate(storyId, { updatedAt: new Date(), updatedBy: adminUser });

      return res.status(201).json({ success: true, message: successMsg, data: newChap });
    } else {
      const existingChap = inMemoryDb.chapters.find(c => String(c.storyId) === String(storyId) && Number(c.chapterNumber) === chapNum);
      if (existingChap) {
        return res.status(400).json({ success: false, message: `Chương ${chapNum} đã tồn tại trong truyện này. Vui lòng chọn số chương khác.` });
      }

      const newChap = {
        _id: 'chap_' + Date.now(),
        storyId,
        chapterNumber: chapNum,
        title,
        content,
        views: 0,
        publishedAt: publishDate,
        createdBy: adminUser,
        updatedBy: adminUser,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      inMemoryDb.chapters.push(newChap);

      const story = inMemoryDb.stories.find(s => String(s._id) === String(storyId));
      if (story) {
        story.updatedAt = new Date();
        story.updatedBy = adminUser;
      }
      saveInMemoryDb();

      return res.status(201).json({ success: true, message: successMsg, data: newChap });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/v1/admin/chapters/:id - Update chapter
router.put('/chapters/:id', verifyAdminToken, async (req, res) => {
  try {
    const chapId = req.params.id;
    const { chapterNumber, title, content, publishedAt } = req.body;
    const adminUser = req.admin ? req.admin.username : 'admin';

    if (isDbConnected() && mongoose.Types.ObjectId.isValid(chapId)) {
      const chap = await Chapter.findById(chapId);
      if (!chap) return res.status(404).json({ success: false, message: 'Không tìm thấy chương.' });

      if (chapterNumber !== undefined) {
        const targetChapNum = Number(chapterNumber);
        const existingChap = await Chapter.findOne({ storyId: chap.storyId, chapterNumber: targetChapNum, _id: { $ne: chap._id } });
        if (existingChap) {
          return res.status(400).json({ success: false, message: `Chương ${targetChapNum} đã tồn tại trong truyện này. Vui lòng chọn số chương khác.` });
        }
        chap.chapterNumber = targetChapNum;
      }
      if (title !== undefined) chap.title = title;
      if (content !== undefined) chap.content = content;
      if (publishedAt !== undefined) {
        if (publishedAt) {
          const parsedDate = new Date(publishedAt);
          if (!isNaN(parsedDate.getTime())) chap.publishedAt = parsedDate;
        } else {
          chap.publishedAt = new Date();
        }
      }
      chap.updatedBy = adminUser;
      chap.updatedAt = new Date();

      await chap.save();
      await Story.findByIdAndUpdate(chap.storyId, { updatedAt: new Date(), updatedBy: adminUser });

      const isScheduled = chap.publishedAt && new Date(chap.publishedAt) > new Date();
      const msg = isScheduled
        ? `⏰ Đã lưu lịch đăng chương tự động vào lúc ${new Date(chap.publishedAt).toLocaleString('vi-VN')}`
        : '🎉 Cập nhật chương thành công!';

      return res.json({ success: true, message: msg, data: chap });
    } else {
      const chap = inMemoryDb.chapters.find(c => String(c._id) === String(chapId));
      if (!chap) return res.status(404).json({ success: false, message: 'Không tìm thấy chương.' });

      if (chapterNumber !== undefined) {
        const targetChapNum = Number(chapterNumber);
        const existingChap = inMemoryDb.chapters.find(c => String(c.storyId) === String(chap.storyId) && Number(c.chapterNumber) === targetChapNum && String(c._id) !== String(chapId));
        if (existingChap) {
          return res.status(400).json({ success: false, message: `Chương ${targetChapNum} đã tồn tại trong truyện này. Vui lòng chọn số chương khác.` });
        }
        chap.chapterNumber = targetChapNum;
      }
      if (title !== undefined) chap.title = title;
      if (content !== undefined) chap.content = content;
      if (publishedAt !== undefined) {
        if (publishedAt) {
          const parsedDate = new Date(publishedAt);
          if (!isNaN(parsedDate.getTime())) chap.publishedAt = parsedDate;
        } else {
          chap.publishedAt = new Date();
        }
      }
      chap.updatedBy = adminUser;
      chap.updatedAt = new Date();

      const story = inMemoryDb.stories.find(s => String(s._id) === String(chap.storyId));
      if (story) {
        story.updatedAt = new Date();
        story.updatedBy = adminUser;
      }

      const isScheduled = chap.publishedAt && new Date(chap.publishedAt) > new Date();
      const msg = isScheduled
        ? `⏰ Đã lưu lịch đăng chương tự động vào lúc ${new Date(chap.publishedAt).toLocaleString('vi-VN')}`
        : '🎉 Cập nhật chương thành công!';
      saveInMemoryDb();

      return res.json({ success: true, message: msg, data: chap });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/v1/admin/chapters/:id - Delete chapter
router.delete('/chapters/:id', verifyAdminToken, async (req, res) => {
  try {
    const chapId = req.params.id;

    if (isDbConnected() && mongoose.Types.ObjectId.isValid(chapId)) {
      await Chapter.findByIdAndDelete(chapId);
      return res.json({ success: true, message: 'Đã xóa chương.' });
    } else {
      inMemoryDb.chapters = inMemoryDb.chapters.filter(c => String(c._id) !== String(chapId));
      saveInMemoryDb();
      return res.json({ success: true, message: 'Đã xóa chương.' });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// ADMIN ACCOUNTS MANAGEMENT ROUTES (CRUD)
// -------------------------------------------------------------

// GET /api/v1/admin/accounts - Get all admin accounts
router.get('/accounts', verifyAdminToken, async (req, res) => {
  try {
    if (isDbConnected()) {
      const accounts = await Admin.find({}, '-password').sort({ createdAt: -1 });
      return res.json({ success: true, data: accounts });
    } else {
      const safeAdmins = (inMemoryDb.admins || []).map(a => ({
        _id: a._id,
        username: a.username,
        role: a.role,
        createdBy: a.createdBy || 'system',
        updatedBy: a.updatedBy || 'system',
        createdAt: a.createdAt,
        updatedAt: a.updatedAt
      }));
      return res.json({ success: true, data: safeAdmins });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/admin/accounts - Create new admin account
router.post('/accounts', verifyAdminToken, async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const currentAdmin = req.admin ? req.admin.username : 'admin';

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tên đăng nhập và mật khẩu.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự.' });
    }

    if (isDbConnected()) {
      const existing = await Admin.findOne({ username: username.trim() });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Tên đăng nhập đã tồn tại.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const newAdmin = await Admin.create({
        username: username.trim(),
        password: hashedPassword,
        role: role || 'ADMIN',
        createdBy: currentAdmin,
        updatedBy: currentAdmin
      });

      return res.status(201).json({
        success: true,
        message: `Đã tạo tài khoản Admin "${newAdmin.username}" thành công!`,
        data: {
          _id: newAdmin._id,
          username: newAdmin.username,
          role: newAdmin.role,
          createdBy: newAdmin.createdBy,
          updatedBy: newAdmin.updatedBy,
          createdAt: newAdmin.createdAt
        }
      });
    } else {
      const existing = (inMemoryDb.admins || []).find(a => a.username.toLowerCase() === username.trim().toLowerCase());
      if (existing) {
        return res.status(400).json({ success: false, message: 'Tên đăng nhập đã tồn tại.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const newAdmin = {
        _id: 'admin_' + Date.now(),
        username: username.trim(),
        password: hashedPassword,
        role: role || 'ADMIN',
        createdBy: currentAdmin,
        updatedBy: currentAdmin,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      if (!inMemoryDb.admins) inMemoryDb.admins = [];
      inMemoryDb.admins.unshift(newAdmin);
      saveInMemoryDb();

      return res.status(201).json({
        success: true,
        message: `Đã tạo tài khoản Admin "${newAdmin.username}" thành công!`,
        data: {
          _id: newAdmin._id,
          username: newAdmin.username,
          role: newAdmin.role,
          createdBy: newAdmin.createdBy,
          updatedBy: newAdmin.updatedBy,
          createdAt: newAdmin.createdAt
        }
      });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/v1/admin/accounts/:id - Update admin account password or role
router.put('/accounts/:id', verifyAdminToken, async (req, res) => {
  try {
    const targetId = req.params.id;
    const { password, role } = req.body;
    const currentAdmin = req.admin ? req.admin.username : 'admin';

    if (isDbConnected() && mongoose.Types.ObjectId.isValid(targetId)) {
      const account = await Admin.findById(targetId);
      if (!account) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });

      if (password) {
        if (password.length < 6) {
          return res.status(400).json({ success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự.' });
        }
        account.password = await bcrypt.hash(password, 10);
      }
      if (role) account.role = role;
      account.updatedBy = currentAdmin;
      account.updatedAt = new Date();

      await account.save();

      return res.json({
        success: true,
        message: `Đã cập nhật tài khoản "${account.username}" thành công!`,
        data: {
          _id: account._id,
          username: account.username,
          role: account.role,
          updatedBy: account.updatedBy,
          updatedAt: account.updatedAt
        }
      });
    } else {
      const account = (inMemoryDb.admins || []).find(a => String(a._id) === String(targetId));
      if (!account) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });

      if (password) {
        if (password.length < 6) {
          return res.status(400).json({ success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự.' });
        }
        account.password = await bcrypt.hash(password, 10);
      }
      if (role) account.role = role;
      account.updatedBy = currentAdmin;
      account.updatedAt = new Date();

      if (inMemoryDb.admin && (inMemoryDb.admin._id === account._id || inMemoryDb.admin.username === account.username)) {
        inMemoryDb.admin = account;
      }
      saveInMemoryDb();

      return res.json({
        success: true,
        message: `Đã cập nhật tài khoản "${account.username}" thành công!`,
        data: {
          _id: account._id,
          username: account.username,
          role: account.role,
          updatedBy: account.updatedBy,
          updatedAt: account.updatedAt
        }
      });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/v1/admin/accounts/:id - Delete admin account
router.delete('/accounts/:id', verifyAdminToken, async (req, res) => {
  try {
    const targetId = req.params.id;
    const currentAdminUsername = req.admin ? req.admin.username : 'admin';

    if (isDbConnected() && mongoose.Types.ObjectId.isValid(targetId)) {
      const targetAccount = await Admin.findById(targetId);
      if (!targetAccount) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });

      if (targetAccount.username === currentAdminUsername) {
        return res.status(400).json({ success: false, message: 'Bạn không thể tự xóa tài khoản đang đăng nhập.' });
      }

      await Admin.findByIdAndDelete(targetId);
      return res.json({ success: true, message: `Đã xóa tài khoản "${targetAccount.username}".` });
    } else {
      const targetAccount = (inMemoryDb.admins || []).find(a => String(a._id) === String(targetId));
      if (!targetAccount) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });

      if (targetAccount.username === currentAdminUsername) {
        return res.status(400).json({ success: false, message: 'Bạn không thể tự xóa tài khoản đang đăng nhập.' });
      }

      inMemoryDb.admins = (inMemoryDb.admins || []).filter(a => String(a._id) !== String(targetId));
      saveInMemoryDb();
      return res.json({ success: true, message: `Đã xóa tài khoản "${targetAccount.username}".` });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/admin/preview - Render live preview of content with embedded image links
router.post('/preview', verifyAdminToken, (req, res) => {
  const { title, content } = req.body;
  const renderedHtml = parseContentToHtml(content || '');

  return res.json({
    success: true,
    data: {
      title: title || 'Tiêu đề xem trước',
      renderedHtml
    }
  });
});

module.exports = router;
