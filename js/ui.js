/**
 * AuraTube UI Controller
 * Manages view switching, toast alerts, modals (Add to Playlist, Settings),
 * search interaction, and renderers for cards, playlists, and queues.
 */

class AuraUIController {
  constructor() {
    this.currentView = 'explore'; // 'explore' | 'queue' | 'playlists' | 'playlist-detail'
    this.activePlaylistId = null;
    this.searchDebounceTimer = null;

    this.initEventListeners();
  }

  showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-notification-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `aura-toast toast-${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    else if (type === 'warning') icon = '⚠️';
    else if (type === 'error') icon = '❌';

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => toast.classList.add('visible'), 20);

    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  switchView(viewName, params = {}) {
    this.currentView = viewName;

    // Update Nav Buttons
    document.querySelectorAll('.nav-link-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    // Hide all view panels
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.add('hidden');
    });

    // Show selected panel
    const target = document.getElementById(`view-${viewName}`);
    if (target) {
      target.classList.remove('hidden');
    }

    if (viewName === 'queue') {
      this.renderQueueView();
    } else if (viewName === 'playlists') {
      this.renderPlaylistsView();
    } else if (viewName === 'playlist-detail' && params.playlistId) {
      this.renderPlaylistDetailView(params.playlistId);
    }
  }

  initEventListeners() {
    // Navigation buttons
    document.querySelectorAll('.nav-link-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        this.switchView(view);
      });
    });

    // Search bar input & submit
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('search-clear-btn');

    if (searchForm) {
      searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query) {
          this.executeSearch(query);
        }
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (clearSearchBtn) {
          clearSearchBtn.classList.toggle('hidden', val.length === 0);
        }

        // Live check if it's a direct youtube link pasted
        const directId = window.AuraApi.extractVideoId(val);
        if (directId) {
          this.executeSearch(val);
        }
      });
    }

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.classList.add('hidden');
        searchInput.focus();
      });
    }

    // Modal close buttons (backdrop + close icon)
    document.querySelectorAll('.modal-backdrop, .modal-close-btn').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target === el || el.classList.contains('modal-close-btn')) {
          this.closeAllModals();
        }
      });
    });

    // New Playlist Modal button
    const openCreatePlaylistBtn = document.getElementById('btn-open-create-playlist');
    if (openCreatePlaylistBtn) {
      openCreatePlaylistBtn.addEventListener('click', () => {
        this.openModal('modal-create-playlist');
      });
    }

    // Settings Modal button
    const openSettingsBtn = document.getElementById('btn-open-settings');
    if (openSettingsBtn) {
      openSettingsBtn.addEventListener('click', () => {
        this.renderSettingsModal();
        this.openModal('modal-settings');
      });
    }

    // Form: Create Playlist
    const createPlaylistForm = document.getElementById('form-create-playlist');
    if (createPlaylistForm) {
      createPlaylistForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('playlist-title-input').value;
        const desc = document.getElementById('playlist-desc-input').value;
        const icon = document.getElementById('playlist-icon-select').value;

        if (title.trim()) {
          const newPl = window.AuraPlaylist.createPlaylist(title, desc, icon);
          this.showToast(`Playlist "${newPl.title}" berhasil dibuat!`, 'success');
          this.closeAllModals();
          createPlaylistForm.reset();
          if (this.currentView === 'playlists') {
            this.renderPlaylistsView();
          }
        }
      });
    }

    // Export / Import Playlist
    const exportBtn = document.getElementById('btn-export-playlists');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.handleExportPlaylists());
    }

    const importInput = document.getElementById('input-import-playlists');
    if (importInput) {
      importInput.addEventListener('change', (e) => this.handleImportPlaylists(e));
    }
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
    }
  }

  closeAllModals() {
    document.querySelectorAll('.aura-modal-wrapper').forEach(m => m.classList.remove('active'));
  }

  async executeSearch(query) {
    this.switchView('explore');
    const container = document.getElementById('search-results-grid');
    const statusHeader = document.getElementById('explore-status-title');

    if (statusHeader) {
      statusHeader.innerHTML = `Mencari "<strong>${this.escapeHtml(query)}</strong>"...`;
    }

    if (container) {
      container.innerHTML = `
        <div class="loading-state-container">
          <div class="spinner-neon"></div>
          <p>Mengekstrak video bebas iklan dari YouTube...</p>
        </div>
      `;
    }

    try {
      const searchRes = await window.AuraApi.search(query);
      if (searchRes.results.length === 0) {
        if (container) {
          container.innerHTML = `
            <div class="empty-state-card">
              <span class="empty-icon">🔍</span>
              <h3>Tidak ada video ditemukan</h3>
              <p>Coba kata kunci lain atau tempel langsung tautan video YouTube.</p>
            </div>
          `;
        }
        return;
      }

      if (statusHeader) {
        statusHeader.innerHTML = searchRes.isDirect
          ? `Tautan Langsung Terdeteksi`
          : `Hasil Pencarian: "<strong>${this.escapeHtml(query)}</strong>" (${searchRes.results.length} video)`;
      }

      this.renderVideoGrid(container, searchRes.results);

      // If direct single video link pasted, automatically play it!
      if (searchRes.isDirect && searchRes.results.length === 1) {
        const item = searchRes.results[0];
        window.AuraPlaylist.addToQueue(item, true);
        window.AuraPlayer.loadTrack(item, true);
        this.showToast(`Memutar video langsung: ${item.title}`, 'success');
      }

    } catch (err) {
      console.error('Search error:', err);
      if (container) {
        container.innerHTML = `
          <div class="empty-state-card">
            <span class="empty-icon">⚠️</span>
            <h3>Gagal Memuat Hasil</h3>
            <p>${err.message}</p>
            <button class="aura-btn aura-btn-primary" onclick="window.AuraUI.executeSearch('${this.escapeHtml(query)}')">Coba Lagi</button>
          </div>
        `;
      }
    }
  }

  async loadTrendingFeed() {
    const container = document.getElementById('search-results-grid');
    const statusHeader = document.getElementById('explore-status-title');

    if (statusHeader) statusHeader.textContent = '🔥 Tren & Rekomendasi Musik Populer';

    if (container) {
      container.innerHTML = `
        <div class="loading-state-container">
          <div class="spinner-neon"></div>
          <p>Memuat video tren bebas iklan...</p>
        </div>
      `;
    }

    try {
      const items = await window.AuraApi.getTrending();
      this.renderVideoGrid(container, items);
    } catch (err) {
      if (container) {
        container.innerHTML = `
          <div class="empty-state-card">
            <span class="empty-icon">⚠️</span>
            <h3>Gagal Memuat Rekomendasi</h3>
            <p>Silakan gunakan kotak pencarian di atas untuk mencari lagu atau tempel URL YouTube.</p>
          </div>
        `;
      }
    }
  }

  renderVideoGrid(container, items) {
    if (!container) return;
    container.innerHTML = '';

    items.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'video-card-item';
      card.setAttribute('data-video-id', item.id);

      card.innerHTML = `
        <div class="card-thumbnail-wrapper">
          <img class="card-thumb-img" src="${item.thumbnail}" alt="${this.escapeHtml(item.title)}" loading="lazy" />
          <span class="card-duration-badge">${item.durationFormatted}</span>
          <div class="card-hover-overlay">
            <button class="card-play-action-btn" title="Putar Sekarang">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </button>
          </div>
        </div>
        <div class="card-meta-content">
          <h4 class="card-title" title="${this.escapeHtml(item.title)}">${this.escapeHtml(item.title)}</h4>
          <div class="card-author-row">
            <span class="card-author">${this.escapeHtml(item.author || 'YouTube')}</span>
            <span class="card-views">${item.viewCount}</span>
          </div>
          <div class="card-actions-row">
            <button class="card-action-btn btn-add-queue" title="Tambah ke antrean">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Antrean
            </button>
            <button class="card-action-btn btn-add-playlist" title="Simpan ke playlist">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg> Simpan
            </button>
          </div>
        </div>
      `;

      // Click thumbnail/play to play immediately
      card.querySelector('.card-thumbnail-wrapper').addEventListener('click', () => {
        window.AuraPlaylist.setQueue([item, ...items.slice(index + 1)], 0);
        window.AuraPlayer.loadTrack(item, true);
        this.showToast(`Memutar: ${item.title}`, 'info');
      });

      // Add to queue
      card.querySelector('.btn-add-queue').addEventListener('click', (e) => {
        e.stopPropagation();
        window.AuraPlaylist.addToQueue(item);
        this.showToast(`"${item.title}" ditambahkan ke antrean!`, 'success');
      });

      // Add to playlist modal
      card.querySelector('.btn-add-playlist').addEventListener('click', (e) => {
        e.stopPropagation();
        this.openAddToPlaylistModal(item);
      });

      container.appendChild(card);
    });
  }

  openAddToPlaylistModal(track) {
    const listContainer = document.getElementById('add-to-playlist-options-list');
    const modal = document.getElementById('modal-add-to-playlist');
    const trackThumb = document.getElementById('add-modal-track-thumb');
    const trackTitle = document.getElementById('add-modal-track-title');

    if (trackThumb) trackThumb.src = track.thumbnail;
    if (trackTitle) trackTitle.textContent = track.title;

    if (listContainer) {
      listContainer.innerHTML = '';
      const playlists = window.AuraPlaylist.playlists;

      playlists.forEach(pl => {
        const itemRow = document.createElement('div');
        itemRow.className = 'playlist-select-item';
        const alreadyIn = pl.items.some(i => i.id === track.id);

        itemRow.innerHTML = `
          <div class="playlist-select-info">
            <span class="pl-icon">${pl.icon || '📁'}</span>
            <div>
              <strong>${this.escapeHtml(pl.title)}</strong>
              <small>${pl.items.length} trek</small>
            </div>
          </div>
          <button class="aura-btn aura-btn-sm ${alreadyIn ? 'aura-btn-secondary' : 'aura-btn-primary'}">
            ${alreadyIn ? 'Sudah Ada' : '+ Tambah'}
          </button>
        `;

        itemRow.querySelector('button').addEventListener('click', () => {
          const res = window.AuraPlaylist.addToPlaylist(pl.id, track);
          if (res.success) {
            this.showToast(res.message, 'success');
            this.closeAllModals();
          } else {
            this.showToast(res.message, 'warning');
          }
        });

        listContainer.appendChild(itemRow);
      });
    }

    this.openModal('modal-add-to-playlist');
  }

  renderQueueView() {
    const container = document.getElementById('queue-items-container');
    const countBadge = document.getElementById('queue-total-count');
    const queue = window.AuraPlaylist.queue;
    const curIdx = window.AuraPlaylist.currentIndex;

    if (countBadge) countBadge.textContent = `${queue.length} trek`;

    if (!container) return;
    if (queue.length === 0) {
      container.innerHTML = `
        <div class="empty-state-card">
          <span class="empty-icon">🎵</span>
          <h3>Antrean Putar Kosong</h3>
          <p>Cari video atau pilih playlist untuk mulai mendengarkan tanpa jeda iklan.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    queue.forEach((track, idx) => {
      const isCurrent = idx === curIdx;
      const row = document.createElement('div');
      row.className = `queue-track-row ${isCurrent ? 'active-playing' : ''}`;

      row.innerHTML = `
        <span class="queue-track-index">${isCurrent ? '▶' : idx + 1}</span>
        <img class="queue-track-thumb" src="${track.thumbnail}" alt="" />
        <div class="queue-track-meta">
          <div class="queue-track-title">${this.escapeHtml(track.title)}</div>
          <div class="queue-track-author">${this.escapeHtml(track.author || '')}</div>
        </div>
        <span class="queue-track-duration">${track.durationFormatted || ''}</span>
        <button class="queue-track-remove-btn" title="Hapus dari antrean">✕</button>
      `;

      row.addEventListener('click', (e) => {
        if (!e.target.classList.contains('queue-track-remove-btn')) {
          window.AuraPlaylist.currentIndex = idx;
          window.AuraPlayer.loadTrack(track, true);
          this.renderQueueView();
        }
      });

      row.querySelector('.queue-track-remove-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        window.AuraPlaylist.removeFromQueue(idx);
        this.renderQueueView();
      });

      container.appendChild(row);
    });
  }

  renderPlaylistsView() {
    const grid = document.getElementById('playlists-grid-container');
    if (!grid) return;

    const playlists = window.AuraPlaylist.playlists;
    grid.innerHTML = '';

    playlists.forEach(pl => {
      const card = document.createElement('div');
      card.className = 'playlist-card-box';

      // Pick thumbnail from first track if available
      const coverThumb = pl.items.length > 0 && pl.items[0].thumbnail
        ? pl.items[0].thumbnail
        : '';

      card.innerHTML = `
        <div class="playlist-card-cover" style="${coverThumb ? `background-image: url('${coverThumb}')` : ''}">
          ${coverThumb ? '' : `<span class="playlist-card-emoji">${pl.icon || '📁'}</span>`}
          <div class="playlist-card-overlay">
            <button class="playlist-card-play-btn" title="Putar Semua">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </button>
          </div>
        </div>
        <div class="playlist-card-info">
          <h4>${this.escapeHtml(pl.title)}</h4>
          <p>${pl.items.length} Trek • ${this.escapeHtml(pl.description || 'Playlist Kustom')}</p>
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.closest('.playlist-card-play-btn')) {
          if (pl.items.length > 0) {
            window.AuraPlaylist.setQueue(pl.items, 0);
            window.AuraPlayer.loadTrack(pl.items[0], true);
            this.showToast(`Memutar playlist: "${pl.title}"`, 'info');
          } else {
            this.showToast('Playlist ini masih kosong', 'warning');
          }
        } else {
          this.switchView('playlist-detail', { playlistId: pl.id });
        }
      });

      grid.appendChild(card);
    });
  }

  renderPlaylistDetailView(playlistId) {
    this.activePlaylistId = playlistId;
    const pl = window.AuraPlaylist.getPlaylist(playlistId);
    if (!pl) {
      this.switchView('playlists');
      return;
    }

    const titleEl = document.getElementById('playlist-detail-title');
    const descEl = document.getElementById('playlist-detail-desc');
    const countEl = document.getElementById('playlist-detail-count');
    const listContainer = document.getElementById('playlist-detail-tracks-list');
    const deleteBtn = document.getElementById('btn-delete-active-playlist');

    if (titleEl) titleEl.textContent = `${pl.icon || '📁'} ${pl.title}`;
    if (descEl) descEl.textContent = pl.description || 'Koleksi musik pribadi';
    if (countEl) countEl.textContent = `${pl.items.length} Trek`;

    // Favorites cannot be deleted
    if (deleteBtn) {
      deleteBtn.classList.toggle('hidden', pl.id === window.AuraPlaylist.FAVORITES_ID);
      deleteBtn.onclick = () => {
        if (confirm(`Yakin ingin menghapus playlist "${pl.title}"?`)) {
          window.AuraPlaylist.deletePlaylist(pl.id);
          this.showToast(`Playlist "${pl.title}" dihapus.`, 'info');
          this.switchView('playlists');
        }
      };
    }

    // Play all button
    const playAllBtn = document.getElementById('btn-play-all-playlist');
    if (playAllBtn) {
      playAllBtn.onclick = () => {
        if (pl.items.length > 0) {
          window.AuraPlaylist.setQueue(pl.items, 0);
          window.AuraPlayer.loadTrack(pl.items[0], true);
          this.showToast(`Memutar playlist: "${pl.title}"`, 'info');
        } else {
          this.showToast('Tambahkan video terlebih dahulu!', 'warning');
        }
      };
    }

    if (!listContainer) return;
    if (pl.items.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state-card">
          <span class="empty-icon">📭</span>
          <h3>Playlist Masih Kosong</h3>
          <p>Gunakan tombol "Simpan" pada video untuk menambahkan trek ke playlist ini.</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = '';
    pl.items.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'queue-track-row';

      row.innerHTML = `
        <span class="queue-track-index">${index + 1}</span>
        <img class="queue-track-thumb" src="${item.thumbnail}" alt="" />
        <div class="queue-track-meta">
          <div class="queue-track-title">${this.escapeHtml(item.title)}</div>
          <div class="queue-track-author">${this.escapeHtml(item.author || '')}</div>
        </div>
        <span class="queue-track-duration">${item.durationFormatted || ''}</span>
        <button class="queue-track-remove-btn" title="Hapus dari playlist">✕</button>
      `;

      row.addEventListener('click', (e) => {
        if (!e.target.classList.contains('queue-track-remove-btn')) {
          window.AuraPlaylist.setQueue(pl.items, index);
          window.AuraPlayer.loadTrack(item, true);
        }
      });

      row.querySelector('.queue-track-remove-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        window.AuraPlaylist.removeFromPlaylist(pl.id, item.id);
        this.renderPlaylistDetailView(pl.id);
        this.showToast('Trek dihapus dari playlist.', 'info');
      });

      listContainer.appendChild(row);
    });
  }

  renderSettingsModal() {
    const instanceList = document.getElementById('settings-instances-list');
    const activeUrl = window.AuraApi.getActiveInstance();

    if (instanceList) {
      instanceList.innerHTML = '';
      window.AuraApi.instances.forEach(inst => {
        const item = document.createElement('div');
        const isActive = inst.url === activeUrl;
        item.className = `settings-instance-item ${isActive ? 'active' : ''}`;

        item.innerHTML = `
          <div>
            <div class="instance-name">
              <span class="status-dot ${inst.status === 'online' ? 'online' : (inst.status === 'error' ? 'error' : 'neutral')}"></span>
              <strong>${this.escapeHtml(inst.name)}</strong>
              ${isActive ? '<span class="badge-active">Aktif</span>' : ''}
            </div>
            <div class="instance-url">${this.escapeHtml(inst.url)}</div>
          </div>
          <button class="aura-btn aura-btn-sm ${isActive ? 'aura-btn-secondary' : 'aura-btn-primary'}">
            ${isActive ? 'Digunakan' : 'Pilih'}
          </button>
        `;

        item.querySelector('button').addEventListener('click', () => {
          window.AuraApi.setActiveInstance(inst.url);
          this.renderSettingsModal();
          this.showToast(`Server beralih ke ${inst.name}`, 'success');
        });

        instanceList.appendChild(item);
      });
    }

    // Custom instance form
    const customForm = document.getElementById('form-add-custom-instance');
    if (customForm) {
      customForm.onsubmit = (e) => {
        e.preventDefault();
        const input = document.getElementById('custom-instance-url-input');
        const url = input.value.trim().replace(/\/$/, '');
        if (url.startsWith('http')) {
          window.AuraApi.setActiveInstance(url);
          input.value = '';
          this.renderSettingsModal();
          this.showToast('Server kustom berhasil ditambahkan & diaktifkan!', 'success');
        } else {
          this.showToast('Masukkan URL yang valid (dimulai dengan https://)', 'warning');
        }
      };
    }
  }

  handleExportPlaylists() {
    const jsonStr = window.AuraPlaylist.exportPlaylistsJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auratube_playlists_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast('Playlist berhasil diekspor ke file JSON!', 'success');
  }

  handleImportPlaylists(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      const res = window.AuraPlaylist.importPlaylistsJSON(content);
      if (res.success) {
        this.showToast(`Berhasil mengimpor ${res.count} playlist!`, 'success');
        if (this.currentView === 'playlists') this.renderPlaylistsView();
      } else {
        this.showToast(`Gagal mengimpor: ${res.error}`, 'error');
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  }

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Global UI instance
window.AuraUI = new AuraUIController();
