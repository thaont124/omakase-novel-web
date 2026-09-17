// In-Memory Fast Cache & View Buffer Service
// Zero external infrastructure required (No Redis setup needed!)

class MemoryCache {
  constructor(defaultTTLSeconds = 120, maxKeys = 500) {
    this.cache = new Map();
    this.defaultTTL = defaultTTLSeconds * 1000;
    this.maxKeys = maxKeys;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  set(key, value, ttlSeconds) {
    if (this.cache.size >= this.maxKeys) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    const ttl = (ttlSeconds ? ttlSeconds * 1000 : this.defaultTTL);
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl
    });
  }

  del(key) {
    this.cache.delete(key);
  }

  clearPattern(pattern) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  flush() {
    this.cache.clear();
  }
}

const cache = new MemoryCache(120, 500); // Cache items for 2 minutes, max 500 entries

// In-Memory View Buffer (Prevents MongoDB write-locking on high concurrent readers)
const viewBuffer = {
  stories: new Map(),
  chapters: new Map()
};

function addStoryView(storyId) {
  if (!storyId) return;
  const current = viewBuffer.stories.get(String(storyId)) || 0;
  viewBuffer.stories.set(String(storyId), current + 1);
}

function addChapterView(chapterId) {
  if (!chapterId) return;
  const current = viewBuffer.chapters.get(String(chapterId)) || 0;
  viewBuffer.chapters.set(String(chapterId), current + 1);
}

// Asynchronously batch-flush buffered view counts to MongoDB every 30 seconds
function startViewFlusher(StoryModel, ChapterModel) {
  setInterval(async () => {
    if (viewBuffer.stories.size > 0) {
      const storyEntries = Array.from(viewBuffer.stories.entries());
      viewBuffer.stories.clear();
      for (const [id, count] of storyEntries) {
        try {
          await StoryModel.findByIdAndUpdate(id, { $inc: { views: count } });
        } catch (e) {}
      }
    }

    if (viewBuffer.chapters.size > 0) {
      const chapterEntries = Array.from(viewBuffer.chapters.entries());
      viewBuffer.chapters.clear();
      for (const [id, count] of chapterEntries) {
        try {
          await ChapterModel.findByIdAndUpdate(id, { $inc: { views: count } });
        } catch (e) {}
      }
    }
  }, 30000);
}

module.exports = {
  cache,
  addStoryView,
  addChapterView,
  startViewFlusher
};
