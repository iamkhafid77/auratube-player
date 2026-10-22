<p align="center">
  <img src="assets/logo-transparent.png" alt="AuraTube Logo" width="220">
</p>

# 🎵 AuraTube - Pemutar YouTube Bebas Iklan & Audio Player Modern

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Deployed-black?logo=vercel&logoColor=white)](https://auratube-player.vercel.app)
[![GitHub Repository](https://img.shields.io/badge/GitHub-Repository-blue?logo=github)](https://github.com/iamkhafid77/auratube-player)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

🌐 **Live Demo Publik**: [https://auratube-player.vercel.app](https://auratube-player.vercel.app)

**AuraTube** adalah aplikasi web modern berbasis *Client-Side & Lightweight Server* yang memungkinkan Anda mencari dan memutar video maupun audio YouTube **100% tanpa iklan**, tanpa memerlukan akun Google, dan hemat kuota data internet.

---

## ✨ Fitur Utama

1. **🚫 100% Bebas Iklan (Ad-Free Streaming)**:
   - Mengambil tautan stream video dan audio langsung via extractor API Invidious & Piped open-source.
   - Tidak pernah memuat script iklan, banner, maupun pop-up YouTube.

2. **🔍 Fitur Pencarian Cerdas & Input Fleksibel**:
   - Cari video menggunakan kata kunci (misal: *lagu pop indonesia*, *lofi hip hop*, *podcast*).
   - **Tempel langsung tautan YouTube**:
     - `https://www.youtube.com/watch?v=...`
     - `https://youtu.be/...`
     - `https://youtube.com/shorts/...`
     - Maupun ID 11 karakter (misal: `dQw4w9WgXcQ`).

3. **🎧 Mode Audio Player Khusus (Hemat Kuota ~80%)**:
   - Tombol toggle instan: **🎬 Video Mode** ⇄ **🎵 Audio Mode**.
   - Mengambil stream audio mentah (*Opus/M4A 128 kbps*) tanpa mengunduh video berat.
   - Dilengkapi **animasi piringan hitam (*vinyl disc*) yang berputar** dan **audio visualizer bar neon** yang memukau.
   - Mengintegrasikan **MediaSession API** (bisa dikontrol dari tombol keyboard laptop, headset, dan lock screen).

4. **📚 Manajemen Playlist Lokal (LocalStorage & Export/Import)**:
   - Playlist bawaan: **❤️ Lagu Favorit** & **☕ Santai & Lofi**.
   - Buat playlist kustom tanpa batas dengan judul, deskripsi, dan pilihan emoji unik.
   - Tambahkan dan hapus trek ke playlist dengan satu klik.
   - **Fitur Ekspor & Impor JSON**: Koleksi playlist dapat diunduh ke file `.json` dan dipulihkan kembali kapan saja.

5. **🌐 Multi-Server Auto-Fallback & Pengaturan Server**:
   - Dilengkapi daftar server instance Invidious berkecepatan tinggi (`invidious.f5.si`, `invidious.ducks.party`, dll).
   - Jika suatu server mengalami gangguan, aplikasi otomatis beralih ke server cadangan.
   - Mendukung penambahan URL instance kustom Anda sendiri.
   - Opsi cadangan darurat (*Clean Embed Mode*) jika video memiliki pembatasan hak cipta regional.

6. **🎨 Desain Minimalis & Futuristik**:
   - Antarmuka Dark Mode elegan dengan efek *Glassmorphism* dan aksen gradasi neon (*Indigo & Fuchsia*).
   - Floating Bottom Player yang selalu siap diakses di halaman mana pun.
   - Desain sepenuhnya responsif di Desktop, Tablet, dan Smartphone.

---

## 🚀 Cara Menjalankan Aplikasi

Aplikasi ini sangat ringan dan tidak memerlukan instalasi dependensi pihak ketiga (*Zero Dependency*).

### Pilihan 1: Klik Dua Kali (Paling Mudah di Windows)
Cukup klik dua kali file **`jalankan.bat`** di folder project. File ini akan otomatis menjalankan server dan membuka peramban ke `http://localhost:3000`.

### Pilihan 2: Melalui Terminal / PowerShell
Buka terminal / PowerShell di folder ini (`d:\PROJECT\PLAYER YOUTUBE`), lalu jalankan:

```bash
node server.js
```
*atau jika menggunakan npm:*
```bash
npm.cmd start
```

> **Catatan PowerShell di Windows:** Jika menjalankan `npm start` memunculkan pesan error *`PSSecurityException / running scripts is disabled`*, gunakan perintah `node server.js` atau `npm.cmd start` langsung.

Buka peramban (browser) Anda dan akses:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## ⌨️ Pintasan Keyboard (Keyboard Shortcuts)

| Tombol | Fungsi |
|---|---|
| **Spasi (Space)** | Putar / Jeda (*Play / Pause*) |
| **Panah Kanan (→)** | Maju 5 detik |
| **Panah Kiri (←)** | Mundur 5 detik |
| **Panah Atas (↑)** | Tambah Volume (+5%) |
| **Panah Bawah (↓)** | Kurangi Volume (-5%) |
| **M** | Bisukan / Bunyikan Suara (*Mute Toggle*) |
| **F** | Layar Penuh (*Fullscreen*) |
| **A** | Alihkan Mode (*Toggle Video ⇄ Audio*) |
| **N** | Putar Trek Selanjutnya (*Next*) |
| **P** | Putar Trek Sebelumnya (*Previous*) |

---

## 📁 Struktur Direktori

```
d:/PROJECT/PLAYER YOUTUBE/
├── index.html              # Antarmuka utama aplikasi web
├── server.js               # Server lokal HTTP ringan (Zero dependency)
├── package.json            # Konfigurasi & skrip npm
├── README.md               # Dokumentasi panduan penggunaan
├── css/
│   ├── style.css           # Desain tema gelap, glassmorphism, & layout
│   └── player.css          # Desain pemutar video, visualizer, & vinyl audio
└── js/
    ├── api.js              # Client Invidious API dengan failover otomatis
    ├── playlist.js         # Pengelola playlist & antrean putar (LocalStorage)
    ├── player.js           # Kontroler pemutar audio/video & MediaSession
    ├── ui.js               # Pengelola modal, view navigation, dan toast alert
    └── app.js              # Inisialisasi aplikasi & event shortcut keyboard
```
