const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Story = require('../models/Story');
const Chapter = require('../models/Chapter');
const Settings = require('../models/Settings');
const { inMemoryDb, saveInMemoryDb } = require('../services/dataStore');

// Helper to check DB status
const isDbConnected = () => mongoose.connection.readyState === 1;

// 1. GET /api/v1/user/settings - Get site UI settings
router.get('/settings', async (req, res) => {
  try {
    if (isDbConnected()) {
      let settings = await Settings.findOne();
      if (!settings) {
        settings = inMemoryDb.settings;
      }
      return res.json({ success: true, data: settings });
    } else {
      return res.json({ success: true, data: inMemoryDb.settings });
    }
  } catch (err) {
    return res.json({ success: true, data: inMemoryDb.settings });
  }
});

// 2. GET /api/v1/user/stories - Get stories list (with search & genre filter)
router.get('/stories', async (req, res) => {
  try {
    const { search, genre } = req.query;

    if (isDbConnected()) {
      let filter = {};
      if (search) {
        filter.title = { $regex: search, $options: 'i' };
      }
      if (genre) {
        filter.genres = genre;
      }
      const stories = await Story.find(filter).sort({ updatedAt: -1 });
      return res.json({ success: true, count: stories.length, data: stories });
    } else {
      let list = [...inMemoryDb.stories];
      if (search) {
        const q = search.toLowerCase();
        list = list.filter(s => s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
      }
      if (genre) {
        list = list.filter(s => s.genres && s.genres.includes(genre));
      }
      return res.json({ success: true, count: list.length, data: list });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 3. GET /api/v1/user/stories/:id - Get story details & list of chapters
router.get('/stories/:id', async (req, res) => {
  try {
    const storyId = req.params.id;
    const now = new Date();

    if (isDbConnected() && mongoose.Types.ObjectId.isValid(storyId)) {
      const story = await Story.findById(storyId);
      if (!story) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy truyện' });
      }

      // Increment views count
      story.views = (story.views || 0) + 1;
      await story.save();

      const chapters = await Chapter.find({
        storyId: story._id,
        $or: [
          { publishedAt: { $exists: false } },
          { publishedAt: null },
          { publishedAt: { $lte: now } }
        ]
      })
        .select('_id chapterNumber title createdAt publishedAt views')
        .sort({ chapterNumber: 1 });

      return res.json({
        success: true,
        data: {
          ...story.toObject(),
          chapters
        }
      });
    } else {
      // Memory fallback
      const story = inMemoryDb.stories.find(s => String(s._id) === String(storyId));
      if (!story) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy truyện' });
      }
      story.views = (story.views || 0) + 1;

      const chapters = inMemoryDb.chapters
        .filter(c => String(c.storyId) === String(storyId) && (!c.publishedAt || new Date(c.publishedAt) <= now))
        .map(c => ({
          _id: c._id,
          chapterNumber: c.chapterNumber,
          title: c.title,
          createdAt: c.createdAt,
          publishedAt: c.publishedAt,
          views: c.views
        }))
        .sort((a, b) => a.chapterNumber - b.chapterNumber);

      return res.json({
        success: true,
        data: {
          ...story,
          chapters
        }
      });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 4. GET /api/v1/user/chapters/:id - Get chapter details & chapter navigation links
router.get('/chapters/:id', async (req, res) => {
  try {
    const chapterId = req.params.id;
    const now = new Date();

    if (isDbConnected() && mongoose.Types.ObjectId.isValid(chapterId)) {
      const chapter = await Chapter.findById(chapterId);
      if (!chapter) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy chương' });
      }

      if (chapter.publishedAt && new Date(chapter.publishedAt) > now) {
        return res.status(404).json({ success: false, message: 'Chương này chưa đến thời gian xuất bản.' });
      }

      chapter.views = (chapter.views || 0) + 1;
      await chapter.save();

      const story = await Story.findById(chapter.storyId);
      const allChapters = await Chapter.find({
        storyId: chapter.storyId,
        $or: [
          { publishedAt: { $exists: false } },
          { publishedAt: null },
          { publishedAt: { $lte: now } }
        ]
      })
        .select('_id chapterNumber title publishedAt')
        .sort({ chapterNumber: 1 });

      const currentIndex = allChapters.findIndex(c => c._id.toString() === chapter._id.toString());
      const prevChapter = currentIndex > 0 ? allChapters[currentIndex - 1] : null;
      const nextChapter = currentIndex < allChapters.length - 1 ? allChapters[currentIndex + 1] : null;

      return res.json({
        success: true,
        data: {
          ...chapter.toObject(),
          storyTitle: story ? story.title : '',
          allChapters,
          prevChapter,
          nextChapter
        }
      });
    } else {
      // Memory fallback
      const chapter = inMemoryDb.chapters.find(c => String(c._id) === String(chapterId));
      if (!chapter) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy chương' });
      }

      if (chapter.publishedAt && new Date(chapter.publishedAt) > now) {
        return res.status(404).json({ success: false, message: 'Chương này chưa đến thời gian xuất bản.' });
      }

      chapter.views = (chapter.views || 0) + 1;
      saveInMemoryDb();
      const story = inMemoryDb.stories.find(s => String(s._id) === String(chapter.storyId));

      const allChapters = inMemoryDb.chapters
        .filter(c => String(c.storyId) === String(chapter.storyId) && (!c.publishedAt || new Date(c.publishedAt) <= now))
        .map(c => ({ _id: c._id, chapterNumber: c.chapterNumber, title: c.title }))
        .sort((a, b) => a.chapterNumber - b.chapterNumber);

      const currentIndex = allChapters.findIndex(c => String(c._id) === String(chapter._id));
      const prevChapter = currentIndex > 0 ? allChapters[currentIndex - 1] : null;
      const nextChapter = currentIndex < allChapters.length - 1 ? allChapters[currentIndex + 1] : null;

      return res.json({
        success: true,
        data: {
          ...chapter,
          storyTitle: story ? story.title : '',
          allChapters,
          prevChapter,
          nextChapter
        }
      });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
