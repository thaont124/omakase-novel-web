const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Story = require('../models/Story');
const Chapter = require('../models/Chapter');
const Settings = require('../models/Settings');

// 1. GET /api/v1/user/settings - Get site UI settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await Settings.findOne();
    return res.json({ success: true, data: settings || {} });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 2. GET /api/v1/user/stories - Get stories list (with search & genre filter)
router.get('/stories', async (req, res) => {
  try {
    const { search, genre } = req.query;
    let filter = {};
    if (search) {
      filter.title = { $regex: search, $options: 'i' };
    }
    if (genre) {
      filter.genres = genre;
    }
    const stories = await Story.find(filter).sort({ updatedAt: -1 });
    return res.json({ success: true, count: stories.length, data: stories });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 3. GET /api/v1/user/stories/:id - Get story details & list of chapters
router.get('/stories/:id', async (req, res) => {
  try {
    const storyId = req.params.id;
    const now = new Date();

    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(404).json({ success: false, message: 'ID truyện không hợp lệ' });
    }

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
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 4. GET /api/v1/user/chapters/:id - Get chapter details & chapter navigation links
router.get('/chapters/:id', async (req, res) => {
  try {
    const chapterId = req.params.id;
    const now = new Date();

    if (!mongoose.Types.ObjectId.isValid(chapterId)) {
      return res.status(404).json({ success: false, message: 'ID chương không hợp lệ' });
    }

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
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
