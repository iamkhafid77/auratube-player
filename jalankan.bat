@echo off
title AuraTube Player
echo ====================================================
echo  Memulai AuraTube Ad-Free Player...
echo  Membuka http://localhost:3000 di peramban (browser)...
echo ====================================================
start http://localhost:3000
node server.js
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo [ERROR] Gagal menjalankan server. Pastikan Node.js sudah terinstal.
  pause
)
