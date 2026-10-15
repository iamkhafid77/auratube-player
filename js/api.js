/**
 * AuraTube API Manager
 * Handles multi-instance Invidious API requests with auto-fallback,
 * direct link extraction, video/audio stream resolutions, and trending feeds.
 */

class InvidiousApi {
  constructor() {
    this.instances = [
      { url: 'https://invidious.f5.si', name: 'Tokyo Fast (f5.si)', status: 'unknown' },
      { url: 'https://invidious.ducks.party', name: 'Ducks Party', status: 'unknown' },
      { url: 'https://invidious.nerdvpn.de', name: 'NerdVPN DE', status: 'unknown' },
      { url: 'https://inv.nadeko.net', name: 'Nadeko Net', status: 'unknown' }
    ];

    // Load custom or active instance from localStorage if saved
    const savedInstance = localStorage.getItem('auratube_active_instance');
    this.activeInstanceIndex = 0;
    if (savedInstance) {
      const idx = this.instances.findIndex(i => i.url === savedInstance);
      if (idx !== -1) {
        this.activeInstanceIndex = idx;
      } else {
        // Custom instance added by user
        this.instances.unshift({ url: savedInstance, name: 'Custom Instance', status: 'unknown' });
        this.activeInstanceIndex = 0;
      }
    }

    this.onInstanceChange = null;
  }

  getActiveInstance() {
    return this.instances[this.activeInstanceIndex].url;
  }

  getActiveInstanceInfo() {
    return this.instances[this.activeInstanceIndex];
  }

  setActiveInstance(url) {
    let idx = this.instances.findIndex(i => i.url === url);
    if (idx === -1) {
      this.instances.push({ url, name: 'Custom (' + new URL(url).hostname + ')', status: 'unknown' });
      idx = this.instances.length - 1;
    }
    this.activeInstanceIndex = idx;
    localStorage.setItem('auratube_active_instance', url);
    if (this.onInstanceChange) this.onInstanceChange(this.instances[idx]);
  }

  async _fetchWithFallback(endpoint, options = {}, timeoutMs = 8000) {
    let attempts = 0;
    const maxAttempts = this.instances.length;

    while (attempts < maxAttempts) {
      const current = this.instances[this.activeInstanceIndex];
      const fullUrl = `${current.url}${endpoint}`;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const res = await fetch(fullUrl, {
          ...options,
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
        }

        current.status = 'online';
        return await res.json();
      } catch (err) {
        console.warn(`[AuraTube API] Failed on ${current.url}: ${err.message}. Trying next instance...`);
        current.status = 'error';

        // Switch to next available instance
        this.activeInstanceIndex = (this.activeInstanceIndex + 1) % this.instances.length;
        attempts++;

        if (this.onInstanceChange) {
          this.onInstanceChange(this.instances[this.activeInstanceIndex]);
        }
      }
    }

    throw new Error('Semua server alternatif sedang sibuk atau tidak merespons. Silakan coba beberapa saat lagi.');
  }

  /**
   * Extract YouTube Video ID from any input:
   * - standard link: https://www.youtube.com/watch?v=...
   * - short link: https://youtu.be/...
   * - shorts link: https://youtube.com/shorts/...
   * - embed link: https://www.youtube.com/embed/...
   * - raw 11-char ID: dQw4w9WgXcQ
   */
  extractVideoId(query) {
    if (!query) return null;
    const trimmed = query.trim();

    // Check if it's already an 11-char ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      return trimmed;
    }

    // RegEx for youtube URLs
    const patterns = [
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i
    ];

    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Search videos by keyword or direct URL
   */
  async search(query, page = 1) {
    const directId = this.extractVideoId(query);
    if (directId) {
      // If direct ID, fetch this single video and wrap as result
      try {
        const detail = await this.getVideoDetails(directId);
        return {
          isDirect: true,
          results: [{
            id: detail.id,
            title: detail.title,
            author: detail.author,
            authorUrl: detail.authorUrl,
            durationFormatted: detail.durationFormatted,
            durationSeconds: detail.durationSeconds,
            viewCount: detail.viewCount,
            publishedText: detail.publishedText,
            thumbnail: detail.thumbnail,
            description: detail.description
          }]
        };
      } catch (err) {
        // Fall back to standard search if ID query fails
      }
    }

    const endpoint = `/api/v1/search?q=${encodeURIComponent(query)}&page=${page}&type=video`;
    const data = await this._fetchWithFallback(endpoint);

    const items = Array.isArray(data) ? data : (data.items || []);
    const results = items
      .filter(item => item.type === 'video' || item.videoId)
      .map(item => ({
        id: item.videoId,
        title: item.title,
        author: item.author || (item.authorThumbnail ? 'Unknown Channel' : ''),
        authorUrl: item.authorUrl || '',
        durationFormatted: this.formatDuration(item.lengthSeconds),
        durationSeconds: item.lengthSeconds || 0,
        viewCount: this.formatViews(item.viewCount),
        publishedText: item.publishedText || '',
        thumbnail: this.getBestThumbnail(item.videoThumbnails, item.videoId),
        description: item.description || ''
      }));

    return {
      isDirect: false,
      results
    };
  }

  /**
   * Fetch Trending videos to populate initial homepage
   */
  async getTrending() {
    const endpoint = `/api/v1/trending?type=music`;
    try {
      const data = await this._fetchWithFallback(endpoint);
      const items = Array.isArray(data) ? data : [];
      return items.slice(0, 24).map(item => ({
        id: item.videoId,
        title: item.title,
        author: item.author || '',
        authorUrl: item.authorUrl || '',
        durationFormatted: this.formatDuration(item.lengthSeconds),
        durationSeconds: item.lengthSeconds || 0,
        viewCount: this.formatViews(item.viewCount),
        publishedText: item.publishedText || 'Trending',
        thumbnail: this.getBestThumbnail(item.videoThumbnails, item.videoId),
        description: item.description || ''
      }));
    } catch (e) {
      // Fallback search for popular music/chill if trending endpoint is restricted
      const fallback = await this.search('lofi hip hop radio live chill beats');
      return fallback.results;
    }
  }

  /**
   * Get detailed streams and metadata for video and audio
   */
  async getVideoDetails(videoId) {
    const endpoint = `/api/v1/videos/${videoId}`;
    const data = await this._fetchWithFallback(endpoint);

    // Extract Video Streams (combine video+audio formats like 720p, 480p, 360p)
    const videoStreams = [];
    if (data.formatStreams && data.formatStreams.length > 0) {
      data.formatStreams.forEach(fs => {
        videoStreams.push({
          quality: fs.quality || fs.qualityLabel || fs.resolution || 'Auto',
          resolution: fs.resolution || fs.qualityLabel || '360p',
          container: fs.container || 'mp4',
          url: fs.url,
          fps: fs.fps || 30
        });
      });
    }

    // Extract Audio-Only Streams for Audio Player Mode
    const audioStreams = [];
    if (data.adaptiveFormats) {
      data.adaptiveFormats
        .filter(f => f.type && f.type.startsWith('audio'))
        .forEach(af => {
          audioStreams.push({
            bitrate: af.bitrate ? `${Math.round(af.bitrate / 1000)} kbps` : 'Standard',
            rawBitrate: af.bitrate || 0,
            container: af.container || (af.type.includes('mp4') ? 'm4a' : 'webm'),
            url: af.url,
            codec: af.encoding || af.type
          });
        });
      // Sort audio by bitrate highest first
      audioStreams.sort((a, b) => b.rawBitrate - a.rawBitrate);
    }

    // Fallback: If no direct formatStreams, check adaptiveFormats with video
    if (videoStreams.length === 0 && data.adaptiveFormats) {
      data.adaptiveFormats
        .filter(f => f.type && f.type.startsWith('video'))
        .forEach(vf => {
          videoStreams.push({
            quality: vf.resolution || vf.qualityLabel || 'Adaptive',
            resolution: vf.resolution || vf.qualityLabel || 'Adaptive',
            container: vf.container || 'mp4',
            url: vf.url,
            fps: vf.fps || 30
          });
        });
    }

    return {
      id: data.videoId,
      title: data.title,
      description: data.description,
      author: data.author,
      authorId: data.authorId,
      authorUrl: data.authorUrl,
      durationSeconds: data.lengthSeconds,
      durationFormatted: this.formatDuration(data.lengthSeconds),
      viewCount: this.formatViews(data.viewCount),
      likeCount: this.formatViews(data.likeCount),
      publishedText: data.publishedText || '',
      thumbnail: this.getBestThumbnail(data.videoThumbnails, data.videoId),
      videoStreams,
      audioStreams,
      recommendedVideos: (data.recommendedVideos || []).slice(0, 10).map(rv => ({
        id: rv.videoId,
        title: rv.title,
        author: rv.author,
        durationFormatted: this.formatDuration(rv.lengthSeconds),
        durationSeconds: rv.lengthSeconds,
        viewCount: this.formatViews(rv.viewCount),
        thumbnail: this.getBestThumbnail(rv.videoThumbnails, rv.videoId)
      }))
    };
  }

  getBestThumbnail(thumbnails, videoId) {
    if (thumbnails && thumbnails.length > 0) {
      // Pick medium or high resolution thumbnail
      const preferred = thumbnails.find(t => t.quality === 'high' || t.quality === 'medium') || thumbnails[0];
      if (preferred.url) {
        return preferred.url.startsWith('http') ? preferred.url : `${this.getActiveInstance()}${preferred.url}`;
      }
    }
    // High-resolution YouTube CDN thumbnail fallback
    return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  }

  formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const paddedSecs = secs.toString().padStart(2, '0');
    if (hrs > 0) {
      const paddedMins = mins.toString().padStart(2, '0');
      return `${hrs}:${paddedMins}:${paddedSecs}`;
    }
    return `${mins}:${paddedSecs}`;
  }

  formatViews(views) {
    if (!views || isNaN(views)) return '0 ditonton';
    const num = Number(views);
    if (num >= 1_000_000) {
      return (num / 1_000_000).toFixed(1).replace('.0', '') + 'M ditonton';
    }
    if (num >= 1_000) {
      return (num / 1_000).toFixed(1).replace('.0', '') + ' rb ditonton';
    }
    return `${num} ditonton`;
  }
}

// Global singleton instance
window.AuraApi = new InvidiousApi();
