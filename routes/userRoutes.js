const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Story = require('../models/Story');
const Chapter = require('../models/Chapter');
const Settings = require('../models/Settings');
const { cache, addStoryView, addChapterView } = require('../services/cacheService');

// Helper to set Edge CDN Cache headers for Vercel / Cloudflare
function setEdgeCacheHeader(res, maxAge = 60, sMaxAge = 120) {
  res.setHeader('Cache-Control', `public, max-age=${maxAge}, s-maxage=${sMaxAge}, stale-while-revalidate=300`);
}

// 1. GET /api/v1/user/settings - Get site UI settings
router.get('/settings', async (req, res) => {
  try {
    const cacheKey = 'user_settings';
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      setEdgeCacheHeader(res, 300, 600);
      return res.json(cachedData);
    }

    const settings = await Settings.findOne();
    const responsePayload = { success: true, data: settings || {} };
    cache.set(cacheKey, responsePayload, 300);

    setEdgeCacheHeader(res, 300, 600);
    return res.json(responsePayload);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 2. GET /api/v1/user/stories - Get stories list (only public stories)
router.get('/stories', async (req, res) => {
  try {
    const { search, genre } = req.query;
    const cacheKey = `user_stories_${search || ''}_${genre || ''}`;

    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      setEdgeCacheHeader(res, 60, 120);
      return res.json(cachedData);
    }

    let filter = { isPublic: { $ne: false } };
    if (search) {
      filter.title = { $regex: search, $options: 'i' };
    }
    if (genre) {
      filter.genres = genre;
    }
    const stories = await Story.find(filter).sort({ updatedAt: -1 });
    const responsePayload = { success: true, count: stories.length, data: stories };

    cache.set(cacheKey, responsePayload, 60); // 1-minute RAM cache
    setEdgeCacheHeader(res, 60, 120);
    return res.json(responsePayload);
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

    // Buffer view count in RAM asynchronously (zero DB write locks!)
    addStoryView(storyId);

    const cacheKey = `user_story_detail_${storyId}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      setEdgeCacheHeader(res, 60, 120);
      return res.json(cachedData);
    }

    const story = await Story.findById(storyId);
    if (!story || story.isPublic === false) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy truyện hoặc truyện đang ở chế độ riêng tư' });
    }

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

    const responsePayload = {
      success: true,
      data: {
        ...story.toObject(),
        chapters
      }
    };

    cache.set(cacheKey, responsePayload, 60); // 1-minute RAM cache
    setEdgeCacheHeader(res, 60, 120);
    return res.json(responsePayload);
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

    // Buffer chapter view count in RAM asynchronously
    addChapterView(chapterId);

    const cacheKey = `user_chapter_detail_${chapterId}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      setEdgeCacheHeader(res, 120, 300);
      return res.json(cachedData);
    }

    const chapter = await Chapter.findById(chapterId);
    if (!chapter) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy chương' });
    }

    if (chapter.publishedAt && new Date(chapter.publishedAt) > now) {
      return res.status(404).json({ success: false, message: 'Chương này chưa đến thời gian xuất bản.' });
    }

    const story = await Story.findById(chapter.storyId);
    if (!story || story.isPublic === false) {
      return res.status(404).json({ success: false, message: 'Truyện của chương này đang ở chế độ riêng tư.' });
    }

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

    const responsePayload = {
      success: true,
      data: {
        ...chapter.toObject(),
        storyTitle: story ? story.title : '',
        allChapters,
        prevChapter,
        nextChapter
      }
    };

    cache.set(cacheKey, responsePayload, 180); // 3-minute RAM cache for chapter content
    setEdgeCacheHeader(res, 120, 300);
    return res.json(responsePayload);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
