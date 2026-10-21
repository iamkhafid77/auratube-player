/**
 * AuraTube Media Player Controller
 * Seamlessly manages Video and Audio-only playback, MediaSession API,
 * stream selection, audio visualizer, and custom player controls.
 */

class AuraMediaPlayer {
  constructor() {
    this.videoEl = document.getElementById('main-video-element');
    this.audioEl = document.getElementById('main-audio-element');
    this.embedFrame = document.getElementById('main-embed-frame');

    // Preferred mode: 'video' | 'audio' | 'embed'
    this.preferredMode = localStorage.getItem('auratube_preferred_mode') || 'video';
    this.currentMode = this.preferredMode;
    this.currentTrackData = null;
    this.currentStreamDetails = null;

    this.isPlaying = false;
    this.duration = 0;
    this.currentTime = 0;
    this.playbackRate = 1.0;
    this.volume = parseFloat(localStorage.getItem('auratube_volume') || '0.9');
    this.isMuted = localStorage.getItem('auratube_muted') === 'true';

    this.selectedQuality = 'auto';
    this.isLoading = false;

    // Visualizer setup
    this.visualizerCanvas = document.getElementById('audio-visualizer-canvas');
    this.canvasCtx = this.visualizerCanvas ? this.visualizerCanvas.getContext('2d') : null;
    this.visualizerAnimationId = null;

    this.initElements();
    this.initMediaSession();
  }

  getActiveMediaElement() {
    return this.currentMode === 'audio' ? this.audioEl : this.videoEl;
  }

  initElements() {
    [this.videoEl, this.audioEl].forEach(el => {
      if (!el) return;
      el.volume = this.volume;
      el.muted = this.isMuted;

      el.addEventListener('play', () => this.handlePlay());
      el.addEventListener('pause', () => this.handlePause());
      el.addEventListener('timeupdate', () => this.handleTimeUpdate());
      el.addEventListener('loadedmetadata', () => this.handleLoadedMetadata());
      el.addEventListener('ended', () => this.handleEnded());
      el.addEventListener('waiting', () => this.setLoading(true));
      el.addEventListener('canplay', () => this.setLoading(false));
      el.addEventListener('error', (e) => this.handleMediaError(e));
    });

    if (this.visualizerCanvas) {
      this.resizeCanvas();
      window.addEventListener('resize', () => this.resizeCanvas());
    }
  }

  resizeCanvas() {
    if (!this.visualizerCanvas) return;
    this.visualizerCanvas.width = this.visualizerCanvas.clientWidth || 300;
    this.visualizerCanvas.height = this.visualizerCanvas.clientHeight || 80;
  }

  setLoading(loading) {
    this.isLoading = loading;
    const loader = document.getElementById('player-buffering-indicator');
    if (loader) {
      loader.classList.toggle('active', loading);
    }
  }

  async loadTrack(track, autoPlay = true) {
    this.setLoading(true);
    this.currentTrackData = track;

    // Always restore user's preferred mode so the player never gets stuck in embed
    this.currentMode = this.preferredMode;
    this.updateModeUI(this.currentMode);

    // Update UI title, channel, artwork immediately
    this.updatePlayerMetadataUI(track);
    this.updateFavoriteUI(track.id);

    // If user explicitly chose embed as preference, play embed immediately
    if (this.currentMode === 'embed') {
      this.applyStreamSource(autoPlay);
      return;
    }

    try {
      // Fetch fresh streams from Invidious API
      const details = await window.AuraApi.getVideoDetails(track.id);
      this.currentStreamDetails = details;

      // Determine stream based on mode
      this.applyStreamSource(autoPlay);
    } catch (err) {
      console.warn('[AuraPlayer] Stream extraction protected or limited, fallback to Clean Embed:', err);
      // Temporary fallback for this specific track without changing user preference
      this.currentMode = 'embed';
      this.updateModeUI('embed');
      this.applyStreamSource(autoPlay);
      window.AuraUI.showToast(`Memutar "${track.title}" via Clean Embed (Bebas Iklan)`, 'info');
    }
  }

  cleanStopMedia(el) {
    if (!el) return;
    el.pause();
    el.removeAttribute('src');
    el.load();
  }

  applyStreamSource(autoPlay = true) {
    const savedTime = this.currentTime;

    // Handle Embed Mode
    if (this.currentMode === 'embed') {
      this.cleanStopMedia(this.videoEl);
      if (this.videoEl) this.videoEl.classList.add('hidden');
      this.cleanStopMedia(this.audioEl);
      this.stopVisualizer();

      if (this.embedFrame && this.currentTrackData) {
        this.embedFrame.classList.remove('hidden');
        const originParam = window.location.origin && window.location.origin !== 'null'
          ? `&origin=${encodeURIComponent(window.location.origin)}`
          : '';
        this.embedFrame.src = `https://www.youtube.com/embed/${this.currentTrackData.id}?autoplay=1&enablejsapi=1&modestbranding=1&rel=0${originParam}`;
      }
      this.isPlaying = true;
      this.updatePlayPauseUI(true);
      this.setLoading(false);
      this.updateMediaSessionMetadata();
      return;
    }

    // Hide fallback embed frame if active
    if (this.embedFrame) {
      this.embedFrame.src = '';
      this.embedFrame.classList.add('hidden');
    }

    if (!this.currentStreamDetails) {
      // Stream details not available, fallback to embed
      this.currentMode = 'embed';
      this.updateModeUI('embed');
      this.applyStreamSource(autoPlay);
      return;
    }

    const details = this.currentStreamDetails;

    if (this.currentMode === 'audio') {
      // Stop video cleanly without triggering error events
      this.cleanStopMedia(this.videoEl);
      if (this.videoEl) this.videoEl.classList.add('hidden');

      // Pick best audio-only stream
      const audioStreams = details.audioStreams;
      let audioUrl = '';

      if (audioStreams && audioStreams.length > 0) {
        audioUrl = audioStreams[0].url;
      } else if (details.videoStreams && details.videoStreams.length > 0) {
        audioUrl = details.videoStreams[0].url;
      }

      if (!audioUrl) throw new Error('Tidak ada stream audio yang tersedia.');

      // Start audio
      this.audioEl.src = audioUrl;
      this.audioEl.currentTime = savedTime || 0;
      this.audioEl.playbackRate = this.playbackRate;

      if (autoPlay) {
        this.audioEl.play().catch(e => console.log('Autoplay prevented:', e));
      }
      this.startVisualizer();

    } else if (this.currentMode === 'video') {
      // Stop audio cleanly without triggering error events
      this.cleanStopMedia(this.audioEl);
      this.stopVisualizer();

      // Pick best video stream
      const videoStreams = details.videoStreams;
      let videoUrl = '';

      if (videoStreams && videoStreams.length > 0) {
        // If user picked a quality
        const match = videoStreams.find(s => s.resolution === this.selectedQuality);
        videoUrl = match ? match.url : videoStreams[0].url;
      }

      if (!videoUrl) throw new Error('Tidak ada stream video yang tersedia.');

      // Start video
      this.videoEl.classList.remove('hidden');
      this.videoEl.src = videoUrl;
      this.videoEl.currentTime = savedTime || 0;
      this.videoEl.playbackRate = this.playbackRate;

      if (autoPlay) {
        this.videoEl.play().catch(e => console.log('Autoplay prevented:', e));
      }
    }

    this.updateMediaSessionMetadata();
  }

  switchMode(targetMode, showToast = true, isUserChoice = false) {
    if (isUserChoice) {
      this.preferredMode = targetMode;
      localStorage.setItem('auratube_preferred_mode', targetMode);
    }
    if (this.currentMode === targetMode) return;
    this.currentMode = targetMode;

    const el = this.getActiveMediaElement();
    if (el) {
      this.currentTime = el.currentTime;
    }

    this.updateModeUI(targetMode);
    this.applyStreamSource(this.isPlaying);
    if (showToast) {
      window.AuraUI.showToast(`Beralih ke mode ${targetMode.toUpperCase()}`, 'info');
    }
  }

  updateModeUI(targetMode) {
    document.querySelectorAll('.mode-toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === targetMode);
    });

    const theaterContainer = document.getElementById('player-theater-stage');
    if (theaterContainer) {
      theaterContainer.setAttribute('data-active-mode', targetMode);
    }
  }

  togglePlay() {
    if (this.currentMode === 'embed') {
      // Embed iframe handles its own clicks
      return;
    }

    const media = this.getActiveMediaElement();
    if (!media || !media.src) {
      // If queue has tracks, play first
      const current = window.AuraPlaylist.getCurrentTrack();
      if (current) {
        this.loadTrack(current, true);
      }
      return;
    }

    if (media.paused) {
      media.play().catch(e => console.log('Play failed:', e));
    } else {
      media.pause();
    }
  }

  handlePlay() {
    this.isPlaying = true;
    this.updatePlayPauseUI(true);
    if (this.currentMode === 'audio') {
      this.startVisualizer();
    }
    const vinyl = document.getElementById('audio-vinyl-disc');
    if (vinyl) vinyl.classList.add('spinning');
  }

  handlePause() {
    this.isPlaying = false;
    this.updatePlayPauseUI(false);
    if (this.currentMode === 'audio') {
      this.stopVisualizer();
    }
    const vinyl = document.getElementById('audio-vinyl-disc');
    if (vinyl) vinyl.classList.remove('spinning');
  }

  handleTimeUpdate() {
    const media = this.getActiveMediaElement();
    if (!media) return;

    this.currentTime = media.currentTime;
    this.duration = media.duration || 0;

    // Update scrubber bar
    const progressPercent = this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0;
    
    // Update main scrubber
    const scrubbers = document.querySelectorAll('.player-scrubber-progress');
    scrubbers.forEach(sc => {
      sc.style.width = `${progressPercent}%`;
    });

    const thumbs = document.querySelectorAll('.player-scrubber-thumb');
    thumbs.forEach(th => {
      th.style.left = `${progressPercent}%`;
    });

    // Time text
    const curTimeText = window.AuraApi.formatDuration(this.currentTime);
    const durTimeText = window.AuraApi.formatDuration(this.duration);

    document.querySelectorAll('.player-current-time').forEach(el => el.textContent = curTimeText);
    document.querySelectorAll('.player-total-time').forEach(el => el.textContent = durTimeText);
  }

  handleLoadedMetadata() {
    const media = this.getActiveMediaElement();
    if (!media) return;
    this.duration = media.duration;
    this.setLoading(false);
  }

  handleEnded() {
    console.log('[AuraPlayer] Track ended. Auto-advancing...');
    this.playNext();
  }

  handleMediaError(e) {
    const el = e.target;
    // Strictly ignore errors from non-active media element (e.g. inactive audio/video tag)
    if (el !== this.getActiveMediaElement()) {
      return;
    }

    // Ignore if mode is already embed
    if (this.currentMode === 'embed') {
      return;
    }

    // Ignore if element has no valid src or was intentionally cleared
    const currentSrc = el.getAttribute('src');
    if (!currentSrc || currentSrc.trim() === '' || currentSrc === window.location.href) {
      return;
    }

    // Ignore aborted loads (user changed track or stopped)
    if (el.error && el.error.code === 1) { // MediaError.MEDIA_ERR_ABORTED
      return;
    }

    console.warn('[AuraPlayer] Active media element playback error:', el.error);
    this.setLoading(false);

    // Fallback to clean embed only when active stream legitimately failed to play
    this.currentMode = 'embed';
    this.updateModeUI('embed');
    this.applyStreamSource(true);
    window.AuraUI.showToast('Stream dibatasi oleh CDN, dialihkan ke Clean Embed', 'warning');
  }

  seek(percent) {
    const media = this.getActiveMediaElement();
    if (!media || !media.duration) return;
    media.currentTime = (percent / 100) * media.duration;
  }

  seekBy(seconds) {
    const media = this.getActiveMediaElement();
    if (!media) return;
    media.currentTime = Math.max(0, Math.min(media.duration || 0, media.currentTime + seconds));
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    this.isMuted = this.volume === 0;

    [this.videoEl, this.audioEl].forEach(el => {
      if (el) {
        el.volume = this.volume;
        el.muted = this.isMuted;
      }
    });

    localStorage.setItem('auratube_volume', this.volume.toString());
    localStorage.setItem('auratube_muted', this.isMuted.toString());

    this.updateVolumeUI();
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    [this.videoEl, this.audioEl].forEach(el => {
      if (el) el.muted = this.isMuted;
    });
    localStorage.setItem('auratube_muted', this.isMuted.toString());
    this.updateVolumeUI();
  }

  setPlaybackRate(rate) {
    this.playbackRate = rate;
    [this.videoEl, this.audioEl].forEach(el => {
      if (el) el.playbackRate = rate;
    });
    document.querySelectorAll('.speed-btn').forEach(btn => {
      btn.classList.toggle('active', parseFloat(btn.dataset.speed) === rate);
    });
    window.AuraUI.showToast(`Kecepatan putar: ${rate}x`, 'info');
  }

  setQuality(res) {
    this.selectedQuality = res;
    if (this.currentMode === 'video' && this.currentStreamDetails) {
      this.applyStreamSource(this.isPlaying);
    }
  }

  playNext() {
    const next = window.AuraPlaylist.getNextTrack();
    if (next) {
      this.loadTrack(next, true);
    } else {
      window.AuraUI.showToast('Akhir dari antrean putar', 'info');
    }
  }

  playPrevious() {
    const prev = window.AuraPlaylist.getPreviousTrack();
    if (prev) {
      this.loadTrack(prev, true);
    }
  }

  toggleFullscreen() {
    const theater = document.getElementById('player-theater-stage');
    if (!theater) return;

    if (!document.fullscreenElement) {
      theater.requestFullscreen().catch(err => {
        console.error(`Fullscreen request failed: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  }

  async togglePip() {
    if (this.currentMode !== 'video' || !this.videoEl) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await this.videoEl.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP error:', err);
    }
  }

  // Visualizer Animation for Audio Mode
  startVisualizer() {
    if (!this.visualizerCanvas || !this.canvasCtx) return;
    this.stopVisualizer();

    const canvas = this.visualizerCanvas;
    const ctx = this.canvasCtx;
    const barCount = 32;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / barCount) - 2;

      for (let i = 0; i < barCount; i++) {
        // Aesthetic rhythmic simulation
        const timeFactor = Date.now() / 250;
        const hPercent = 0.15 + (Math.sin(timeFactor + i * 0.4) + 1) * 0.35 + (Math.cos(timeFactor * 1.5 + i) + 1) * 0.15;
        const barHeight = Math.max(4, hPercent * canvas.height * 0.85);

        // Gradient color from electric indigo to neon pink
        const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
        gradient.addColorStop(0, '#ec4899');
        gradient.addColorStop(0.5, '#8b5cf6');
        gradient.addColorStop(1, '#6366f1');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(i * (barWidth + 2), canvas.height - barHeight, barWidth, barHeight, [3, 3, 0, 0]);
        ctx.fill();
      }

      this.visualizerAnimationId = requestAnimationFrame(animate);
    };

    this.visualizerAnimationId = requestAnimationFrame(animate);
  }

  stopVisualizer() {
    if (this.visualizerAnimationId) {
      cancelAnimationFrame(this.visualizerAnimationId);
      this.visualizerAnimationId = null;
    }
    if (this.visualizerCanvas && this.canvasCtx) {
      this.canvasCtx.clearRect(0, 0, this.visualizerCanvas.width, this.visualizerCanvas.height);
    }
  }

  // MediaSession API Integration (Lockscreen, Media Keys, Notifications)
  initMediaSession() {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => this.togglePlay());
      navigator.mediaSession.setActionHandler('pause', () => this.togglePlay());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.playPrevious());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.playNext());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime && this.duration) {
          const media = this.getActiveMediaElement();
          if (media) media.currentTime = details.seekTime;
        }
      });
    }
  }

  updateMediaSessionMetadata() {
    if (!('mediaSession' in navigator) || !this.currentTrackData) return;
    const track = this.currentTrackData;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.author || 'AuraTube Player',
      album: 'AuraTube Bebas Iklan',
      artwork: [
        { src: track.thumbnail, sizes: '512x512', type: 'image/jpeg' }
      ]
    });
  }

  // UI Updaters
  updatePlayerMetadataUI(track) {
    document.querySelectorAll('.current-track-title').forEach(el => el.textContent = track.title);
    document.querySelectorAll('.current-track-artist').forEach(el => el.textContent = track.author || 'Artis');
    document.querySelectorAll('.current-track-art').forEach(img => {
      img.src = track.thumbnail;
      img.alt = track.title;
    });

    const backdrop = document.getElementById('player-backdrop-blur');
    if (backdrop) {
      backdrop.style.backgroundImage = `url('${track.thumbnail}')`;
    }
  }

  updatePlayPauseUI(playing) {
    const playIcons = document.querySelectorAll('.play-icon-svg');
    const pauseIcons = document.querySelectorAll('.pause-icon-svg');

    playIcons.forEach(i => i.classList.toggle('hidden', playing));
    pauseIcons.forEach(i => i.classList.toggle('hidden', !playing));
  }

  updateVolumeUI() {
    const volInputs = document.querySelectorAll('.volume-slider-input');
    volInputs.forEach(inp => {
      inp.value = this.isMuted ? 0 : this.volume * 100;
    });

    const muteIcons = document.querySelectorAll('.vol-icon-mute');
    const normalIcons = document.querySelectorAll('.vol-icon-normal');

    muteIcons.forEach(i => i.classList.toggle('hidden', !this.isMuted));
    normalIcons.forEach(i => i.classList.toggle('hidden', this.isMuted));
  }

  updateFavoriteUI(trackId) {
    const isFav = window.AuraPlaylist.isFavorite(trackId);
    document.querySelectorAll('.favorite-btn-current').forEach(btn => {
      btn.classList.toggle('favorited', isFav);
      btn.setAttribute('aria-label', isFav ? 'Hapus dari favorit' : 'Tambah ke favorit');
    });
  }
}

// Global player singleton
window.AuraPlayer = new AuraMediaPlayer();
