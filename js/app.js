/**
 * AuraTube Main Application Bootstrapper
 * Binds global controls, scrubbers, keyboard shortcuts,
 * and initializes state on page load.
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 AuraTube Ad-Free Player initializing...');

  const player = window.AuraPlayer;
  const playlist = window.AuraPlaylist;
  const ui = window.AuraUI;
  const api = window.AuraApi;

  // Initial UI updates
  player.updateVolumeUI();
  updateInstanceBadge();

  // Load trending feed for homepage
  ui.loadTrendingFeed();

  // API instance status change listener
  api.onInstanceChange = () => {
    updateInstanceBadge();
  };

  function updateInstanceBadge() {
    const badge = document.getElementById('api-instance-status-badge');
    const info = api.getActiveInstanceInfo();
    if (badge && info) {
      badge.textContent = `🟢 ${info.name}`;
      badge.title = `Server Aktif: ${info.url} (Klik untuk pengaturan)`;
    }
  }

  // Bind Theater Stage & Floating Bar Controls
  document.querySelectorAll('.control-play-pause-btn').forEach(btn => {
    btn.addEventListener('click', () => player.togglePlay());
  });

  document.querySelectorAll('.control-next-btn').forEach(btn => {
    btn.addEventListener('click', () => player.playNext());
  });

  document.querySelectorAll('.control-prev-btn').forEach(btn => {
    btn.addEventListener('click', () => player.playPrevious());
  });

  // Shuffle toggle
  const shuffleBtn = document.getElementById('control-shuffle-btn');
  if (shuffleBtn) {
    shuffleBtn.addEventListener('click', () => {
      const active = playlist.toggleShuffle();
      shuffleBtn.classList.toggle('active', active);
      ui.showToast(active ? 'Mode Acak: Aktif' : 'Mode Acak: Mati', 'info');
    });
  }

  // Repeat toggle
  const repeatBtn = document.getElementById('control-repeat-btn');
  if (repeatBtn) {
    repeatBtn.addEventListener('click', () => {
      const mode = playlist.cycleRepeatMode();
      repeatBtn.classList.toggle('active', mode !== 'none');
      repeatBtn.setAttribute('data-repeat-mode', mode);
      const labels = { all: 'Ulang Semua', one: 'Ulang 1 Lagu', none: 'Tidak Diulang' };
      ui.showToast(`Mode Ulang: ${labels[mode]}`, 'info');
    });
  }

  // Favorite toggle on current track
  document.querySelectorAll('.favorite-btn-current').forEach(btn => {
    btn.addEventListener('click', () => {
      const cur = playlist.getCurrentTrack();
      if (!cur) return;
      const added = playlist.toggleFavorite(cur);
      player.updateFavoriteUI(cur.id);
      ui.showToast(added ? 'Ditambahkan ke Favorit ❤️' : 'Dihapus dari Favorit', added ? 'success' : 'info');
    });
  });

  // Mode Switchers (Video vs Audio vs Embed)
  document.querySelectorAll('.mode-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetMode = btn.dataset.mode;
      player.switchMode(targetMode);
    });
  });

  // Scrubber seeking interaction (both click and drag)
  setupScrubberInteractions();

  // Volume slider interaction
  document.querySelectorAll('.volume-slider-input').forEach(inp => {
    inp.addEventListener('input', (e) => {
      player.setVolume(parseFloat(e.target.value) / 100);
    });
  });

  document.querySelectorAll('.volume-mute-btn').forEach(btn => {
    btn.addEventListener('click', () => player.toggleMute());
  });

  // Playback speed buttons
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const speed = parseFloat(btn.dataset.speed);
      player.setPlaybackRate(speed);
    });
  });

  // Fullscreen & PiP
  const fsBtn = document.getElementById('btn-fullscreen-toggle');
  if (fsBtn) fsBtn.addEventListener('click', () => player.toggleFullscreen());

  const pipBtn = document.getElementById('btn-pip-toggle');
  if (pipBtn) pipBtn.addEventListener('click', () => player.togglePip());

  // Quality selector dropdown
  const qualitySelect = document.getElementById('video-quality-select');
  if (qualitySelect) {
    qualitySelect.addEventListener('change', (e) => {
      player.setQuality(e.target.value);
    });
  }

  // Keyboard Shortcuts Handler
  window.addEventListener('keydown', (e) => {
    // Ignore keystrokes when typing in inputs or textareas
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      return;
    }

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        player.togglePlay();
        break;
      case 'ArrowRight':
        e.preventDefault();
        player.seekBy(5);
        ui.showToast('+5 Detik ⏩', 'info', 1000);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        player.seekBy(-5);
        ui.showToast('-5 Detik ⏪', 'info', 1000);
        break;
      case 'ArrowUp':
        e.preventDefault();
        player.setVolume(player.volume + 0.05);
        ui.showToast(`Volume: ${Math.round(player.volume * 100)}% 🔊`, 'info', 1000);
        break;
      case 'ArrowDown':
        e.preventDefault();
        player.setVolume(player.volume - 0.05);
        ui.showToast(`Volume: ${Math.round(player.volume * 100)}% 🔉`, 'info', 1000);
        break;
      case 'KeyM':
        player.toggleMute();
        break;
      case 'KeyF':
        player.toggleFullscreen();
        break;
      case 'KeyA':
        // Toggle Audio/Video mode
        player.switchMode(player.currentMode === 'video' ? 'audio' : 'video');
        break;
      case 'KeyN':
        player.playNext();
        break;
      case 'KeyP':
        player.playPrevious();
        break;
    }
  });

  function setupScrubberInteractions() {
    const scrubbers = document.querySelectorAll('.player-scrubber-track');

    scrubbers.forEach(track => {
      let isDragging = false;

      const handleSeek = (e) => {
        const rect = track.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clickX = Math.max(0, Math.min(rect.width, clientX - rect.left));
        const percent = (clickX / rect.width) * 100;
        player.seek(percent);
      };

      track.addEventListener('mousedown', (e) => {
        isDragging = true;
        handleSeek(e);
      });

      window.addEventListener('mousemove', (e) => {
        if (isDragging) handleSeek(e);
      });

      window.addEventListener('mouseup', () => {
        isDragging = false;
      });

      // Touch events for mobile
      track.addEventListener('touchstart', (e) => {
        isDragging = true;
        handleSeek(e);
      }, { passive: true });

      window.addEventListener('touchmove', (e) => {
        if (isDragging) handleSeek(e);
      }, { passive: true });

      window.addEventListener('touchend', () => {
        isDragging = false;
      });
    });
  }
});
