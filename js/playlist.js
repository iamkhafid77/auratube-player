/**
 * AuraTube Playlist & Queue Store
 * Handles custom playlists, favorites, playback queues,
 * shuffle/repeat modes, and localStorage persistence with Import/Export.
 */

class PlaylistManager {
  constructor() {
    this.STORAGE_KEY = 'auratube_playlists';
    this.QUEUE_KEY = 'auratube_current_queue';
    this.FAVORITES_ID = 'playlist_favorites';

    this.playlists = this.loadPlaylists();
    this.queue = this.loadQueue();
    this.currentIndex = -1;

    // Playback modes: 'none', 'all', 'one'
    this.repeatMode = 'all';
    this.isShuffled = false;
    this.originalQueue = [];

    this.onQueueChange = null;
    this.onPlaylistsChange = null;
  }

  loadPlaylists() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Error loading playlists:', e);
    }

    // Default initial playlists
    const initial = [
      {
        id: this.FAVORITES_ID,
        title: 'Lagu Favorit',
        icon: '❤️',
        description: 'Koleksi video dan lagu yang Anda sukai',
        createdAt: new Date().toISOString(),
        items: []
      },
      {
        id: 'playlist_relax',
        title: 'Santai & Lofi',
        icon: '☕',
        description: 'Musik santai untuk bekerja dan belajar',
        createdAt: new Date().toISOString(),
        items: [
          {
            id: 'jfKfPfyJRdk',
            title: 'lofi hip hop radio 📚 - beats to relax/study to',
            author: 'Lofi Girl',
            durationFormatted: 'LIVE',
            thumbnail: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg'
          }
        ]
      }
    ];
    this.savePlaylists(initial);
    return initial;
  }

  savePlaylists(data = this.playlists) {
    this.playlists = data;
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.playlists));
    } catch (e) {
      console.error('Error saving playlists:', e);
    }
    if (this.onPlaylistsChange) this.onPlaylistsChange(this.playlists);
  }

  loadQueue() {
    try {
      const data = localStorage.getItem(this.QUEUE_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {}
    return [];
  }

  saveQueue() {
    try {
      localStorage.setItem(this.QUEUE_KEY, JSON.stringify(this.queue));
    } catch (e) {}
    if (this.onQueueChange) this.onQueueChange(this.queue, this.currentIndex);
  }

  // Playlist Operations
  createPlaylist(title, description = '', icon = '📁') {
    const newPlaylist = {
      id: 'pl_' + Date.now(),
      title: title.trim() || 'Playlist Baru',
      description: description.trim(),
      icon: icon || '📁',
      createdAt: new Date().toISOString(),
      items: []
    };
    this.playlists.push(newPlaylist);
    this.savePlaylists();
    return newPlaylist;
  }

  deletePlaylist(playlistId) {
    if (playlistId === this.FAVORITES_ID) {
      throw new Error('Playlist Favorit tidak dapat dihapus.');
    }
    this.playlists = this.playlists.filter(p => p.id !== playlistId);
    this.savePlaylists();
  }

  getPlaylist(playlistId) {
    return this.playlists.find(p => p.id === playlistId) || null;
  }

  addToPlaylist(playlistId, track) {
    const playlist = this.getPlaylist(playlistId);
    if (!playlist) throw new Error('Playlist tidak ditemukan.');

    // Avoid duplicates in the same playlist
    const existingIndex = playlist.items.findIndex(item => item.id === track.id);
    if (existingIndex !== -1) {
      return { success: false, message: 'Video ini sudah ada di playlist tersebut.' };
    }

    playlist.items.push({
      id: track.id,
      title: track.title,
      author: track.author,
      durationFormatted: track.durationFormatted || '0:00',
      thumbnail: track.thumbnail,
      addedAt: new Date().toISOString()
    });

    this.savePlaylists();
    return { success: true, message: `Berhasil ditambahkan ke "${playlist.title}"` };
  }

  removeFromPlaylist(playlistId, trackId) {
    const playlist = this.getPlaylist(playlistId);
    if (!playlist) return;
    playlist.items = playlist.items.filter(item => item.id !== trackId);
    this.savePlaylists();
  }

  // Toggle Favorite shortcut
  toggleFavorite(track) {
    const favs = this.getPlaylist(this.FAVORITES_ID);
    if (!favs) return false;

    const exists = favs.items.some(item => item.id === track.id);
    if (exists) {
      this.removeFromPlaylist(this.FAVORITES_ID, track.id);
      return false; // Removed
    } else {
      this.addToPlaylist(this.FAVORITES_ID, track);
      return true; // Added
    }
  }

  isFavorite(trackId) {
    const favs = this.getPlaylist(this.FAVORITES_ID);
    if (!favs) return false;
    return favs.items.some(item => item.id === trackId);
  }

  // Playback Queue Operations
  setQueue(items, startIndex = 0) {
    this.queue = [...items];
    this.originalQueue = [...items];
    this.currentIndex = startIndex;
    if (this.isShuffled) {
      this.applyShuffle();
    }
    this.saveQueue();
  }

  addToQueue(track, playNext = false) {
    if (playNext && this.currentIndex !== -1) {
      this.queue.splice(this.currentIndex + 1, 0, track);
    } else {
      this.queue.push(track);
    }
    this.saveQueue();
  }

  removeFromQueue(index) {
    if (index >= 0 && index < this.queue.length) {
      this.queue.splice(index, 1);
      if (this.currentIndex >= index) {
        this.currentIndex = Math.max(0, this.currentIndex - 1);
      }
      this.saveQueue();
    }
  }

  clearQueue() {
    this.queue = [];
    this.currentIndex = -1;
    this.saveQueue();
  }

  getCurrentTrack() {
    if (this.currentIndex >= 0 && this.currentIndex < this.queue.length) {
      return this.queue[this.currentIndex];
    }
    return null;
  }

  getNextTrack() {
    if (this.queue.length === 0) return null;

    if (this.repeatMode === 'one') {
      return this.getCurrentTrack();
    }

    if (this.currentIndex + 1 < this.queue.length) {
      this.currentIndex++;
      this.saveQueue();
      return this.getCurrentTrack();
    } else if (this.repeatMode === 'all') {
      this.currentIndex = 0;
      this.saveQueue();
      return this.getCurrentTrack();
    }

    return null; // End of queue
  }

  getPreviousTrack() {
    if (this.queue.length === 0) return null;

    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.saveQueue();
      return this.getCurrentTrack();
    } else if (this.repeatMode === 'all') {
      this.currentIndex = this.queue.length - 1;
      this.saveQueue();
      return this.getCurrentTrack();
    }
    return this.getCurrentTrack();
  }

  toggleShuffle() {
    this.isShuffled = !this.isShuffled;
    if (this.isShuffled) {
      this.applyShuffle();
    } else {
      // Restore original queue order while keeping active track current
      const currentTrack = this.getCurrentTrack();
      this.queue = [...this.originalQueue];
      if (currentTrack) {
        this.currentIndex = this.queue.findIndex(t => t.id === currentTrack.id);
      }
    }
    this.saveQueue();
    return this.isShuffled;
  }

  applyShuffle() {
    const currentTrack = this.getCurrentTrack();
    const remaining = this.queue.filter((_, idx) => idx !== this.currentIndex);

    // Fisher-Yates shuffle
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }

    if (currentTrack) {
      this.queue = [currentTrack, ...remaining];
      this.currentIndex = 0;
    } else {
      this.queue = remaining;
    }
  }

  cycleRepeatMode() {
    if (this.repeatMode === 'all') this.repeatMode = 'one';
    else if (this.repeatMode === 'one') this.repeatMode = 'none';
    else this.repeatMode = 'all';
    return this.repeatMode;
  }

  // Import / Export JSON
  exportPlaylistsJSON() {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      playlists: this.playlists
    };
    return JSON.stringify(data, null, 2);
  }

  importPlaylistsJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.playlists || !Array.isArray(parsed.playlists)) {
        throw new Error('Format file JSON playlist tidak valid.');
      }

      // Merge playlists
      parsed.playlists.forEach(imported => {
        const existing = this.playlists.find(p => p.id === imported.id || p.title === imported.title);
        if (existing) {
          // Merge items without duplicates
          imported.items.forEach(item => {
            if (!existing.items.some(i => i.id === item.id)) {
              existing.items.push(item);
            }
          });
        } else {
          this.playlists.push(imported);
        }
      });

      this.savePlaylists();
      return { success: true, count: parsed.playlists.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

// Global singleton instance
window.AuraPlaylist = new PlaylistManager();
