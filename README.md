# JENDERAL

Game kartu remi Indonesia untuk 4 pemain (1 manusia + 3 AI) di browser. HTML5 + CSS3 + JavaScript ES Modules, tanpa framework dan tanpa dependensi runtime. Dirancang mobile-first (layar ponsel portrait diprioritaskan) dan siap di-deploy ke GitHub Pages.

## Fitur
- Mesin permainan otoritatif (`src/core/`): semua aturan divalidasi di satu tempat; UI dan AI hanya memanggil `play / pass / general / declineGeneral`.
- **4 tingkat kesulitan AI** (Mudah, Normal, Sulit, Ahli) yang terpisah dari **3 kepribadian** (Agresif, Strategis, Adaptif). Bisa disamakan untuk semua AI atau diatur per AI (kesulitan dan kepribadian).
- Meja kartu dengan 4 posisi pemain, kartu lawan tertutup, jumlah kartu, indikator giliran / lewat / selesai (juara ke-N), dan indikator status Jenderal (tertutup / TERBUKA / tidak dipakai / berhasil).
- Pilih / batalkan kartu (klik, ketuk, atau keyboard Enter/Spasi). Tombol **Main** hanya aktif jika kombinasi sah, **Lewat** hanya aktif jika aturan mengizinkan, dan alasan kombinasi tidak sah ditampilkan.
- Animasi: pembagian kartu, pilih kartu, kartu terbang ke meja, sorotan giliran, lencana juara, efek Jenderal, konfeti kemenangan. Pengaturan animasi **Penuh / Dikurangi / Mati** (default mengikuti `prefers-reduced-motion`).
- Efek suara opsional (disintesis dengan Web Audio, tanpa berkas audio, tidak memakai aset berhak cipta): kartu, giliran, lewat, Jenderal, menang, kalah. Ada volume dan mute; game tetap berjalan tanpa audio.
- Layar hasil (menang / juara tengah / kalah), urutan peringkat, statistik pertandingan, **Rematch** (tanpa reload) dan Menu Utama. Statistik total + per tingkat kesulitan disimpan lokal (localStorage).
- Jeda (otomatis saat tab disembunyikan), kecepatan AI, panduan aturan.

## Menjalankan
Butuh Node.js 20+.

```bash
npm start              # server statis lokal -> http://localhost:8080
npm test               # semua tes unit/integrasi (node --test)
npm run simulate       # 500 pertandingan AI penuh, tingkat & kepribadian acak per kursi
npm run evaluate:ai    # turnamen tangga 4 tingkat (metrik peringkat + kualitas keputusan)
npm run build          # salin ke dist/ + verifikasi path relatif (check-dist)
npm run test:e2e       # tes browser Playwright terhadap build produksi (lihat bawah)
```
ES Modules tidak bisa dibuka lewat `file://`; gunakan `npm start`.

Untuk meniru sub-path GitHub Pages secara lokal: `npm run build && DIR=dist BASE=/jenderal-game/ npm start`.

### Tes browser (Playwright)
Playwright bukan dependensi proyek. Instal sementara lalu jalankan:
```bash
npm install --no-save playwright
npx playwright install chromium
npm run test:e2e
```
Tes memakai halaman `?e2e=1` yang membuka hook kecil `window.__jenderal` (mulai dari kartu tertentu, baca tampilan tangan pemain sendiri). Hook tidak aktif tanpa parameter itu. Jika Playwright terpasang di tempat lain: `PLAYWRIGHT_MODULE=/path/ke/playwright/index.mjs npm run test:e2e`.

## Deploy ke GitHub Pages
1. Push ke GitHub (branch `main`).
2. Settings → Pages → Source: **GitHub Actions**.
3. `deploy.yml` menjalankan tes unit, simulasi, build, dan tes browser; deploy hanya berjalan jika semuanya lulus (`needs: [test, e2e]`). Artefak yang diunggah adalah `dist/`. Izin minimum: `contents: read`, `pages: write`, `id-token: write`.
4. Semua path aset relatif (`src/...`), sehingga halaman tetap termuat di `https://<user>.github.io/<repo>/`. `scripts/check-dist.mjs` menggagalkan build bila ada path absolut atau referensi yang tidak ditemukan.

`test.yml` berjalan pada setiap push / pull request (Node 20 dan 22, plus tes browser).

## Struktur
- `src/core/` — kartu, dek, kocok seeded, pembagian, kombinasi, validasi, Joker, Jenderal, giliran, engine, `match-stats.js`. `rules.js` memuat semua aturan yang belum pasti.
- `src/ai/` — `ai-player.js` (AIPlayer: kepribadian + kesulitan), `difficulty.js` (profil 4 level), `strategy.js` (penilaian langkah + kepribadian), `knowledge.js` (kartu belum terlihat + risiko Jenderal, hanya info legal), `hand-plan.js` (estimasi langkah menghabiskan kartu), `simulation.js` (pertandingan penuh + metrik), `evaluate.js` (turnamen tangga).
- `src/ui/`, `src/styles/` — antarmuka mobile-first. Tanpa `innerHTML`; seluruh teks lewat `textContent`. `settings.js`, `audio.js`, `scoreboard.js`, dll.
- `tests/` — tes `node:test` (engine, kombinasi, Jenderal, AI, kesulitan, modul UI). `e2e/` — tes browser.
- `scripts/` — `serve`, `build`, `check-dist`, `simulate`, `evaluate-ai`.

## Aturan yang diimplementasikan
54 kartu (52 + 2 Joker), dibagi 14/14/13/13; urutan 3<…<K<A<2; pemegang 3♣ membuka dengan 3♣ tunggal; tunggal, Tris, Tris tekor satu (2 kartu + Joker), Tris gandengan (tris + pasangan lebih rendah, 5 kartu), Tangga (≥3 berurutan, tanpa Joker, panjang sama saat membalas); Joker hanya mengalahkan tunggal berwarna sama; Jenderal (4 kartu sama setelah Joker tunggal, langsung menang); Lewat dan reset putaran; urutan selesai dan pemain terakhir kalah. "Pair" berdiri sendiri **tidak** didukung engine (tetap seperti sebelumnya).

## Asumsi aturan (belum terkonfirmasi, tidak diubah)
Semua ada di `src/core/rules.js` dan `src/core/general.js`.
1. **Seri Tris gandengan**: tidak mungkin dengan satu dek; dibandingkan dari angka tris.
2. **Joker di Tris gandengan**: default *tidak boleh* (`trisGandengan.allowJoker=false`).
3. **Panjang Tangga saat memimpin**: bebas ≥3; saat membalas harus sama. Tangga tidak melewati `2`.
4. **Banyak kombinasi dalam satu giliran**: tidak didukung.
5. **Siapa boleh Jenderal**: default `anyOtherPlayer` (setiap pemain lain yang memegang empat kartu sama, berurutan). Alternatif: `nextPlayerOnly`.
- Joker tidak bisa menimpa Joker (hanya Jenderal). Joker mengalahkan tunggal berwarna sama berapa pun angkanya, termasuk 2. Tris tekor memakai Joker warna apa pun.
- Pemain boleh Lewat meski sebenarnya bisa main; pemimpin putaran tidak boleh Lewat. Pemain yang Lewat tidak ikut lagi sampai putaran selesai.

## Empat tingkat kesulitan AI
Kesulitan hanya mengubah **kualitas keputusan**; aturan permainan tidak berubah dan setiap aksi AI tetap divalidasi engine. AI hanya melihat `engine.view(i)` (tangan sendiri + informasi publik); ada tes yang membuktikan keputusan tidak berubah ketika kartu tersembunyi lawan diganti.

| Level | Perilaku |
|---|---|
| **Mudah** | Memilih langkah termurah secara serakah; 35% langkah acak (termasuk lewat tanpa alasan); sering melewatkan peluang menghabiskan kartu; kurang peduli memecah kombinasi dan memakai Joker; hanya 75% memakai peluang Jenderal; tidak memakai info lawan. |
| **Normal** | Menilai nilai kartu, memecah kombinasi, biaya Joker, dan jumlah kartu lawan; selalu menghabiskan kartu bila bisa; selalu memakai Jenderal; 6% langkah acak. |
| **Sulit** | Menambah: pelacakan kartu yang sudah keluar (kartu yang tak bisa dikalahkan), estimasi sisa langkah menghabiskan kartu, menjaga empat kartu sama hanya selama Joker masih mungkin keluar, menghindari Joker tunggal bila Jenderal lawan mungkin; 2% langkah acak. |
| **Ahli** | Menambah: bobot perencanaan tangan lebih besar, risiko Jenderal terukur secara probabilistik dari kartu yang belum terlihat, antisipasi lawan dengan 1 kartu, lewat strategis saat memakai kartu kuat hanya memberi sedikit kemajuan; tanpa langkah acak. |

**Kepribadian** (independen): Agresif (membuang kartu sebanyak mungkin, jarang lewat), Strategis (menyimpan kartu besar/Joker, boleh lewat), Adaptif (bereaksi pada kartu lawan). Contoh kombinasi: Mudah+Agresif, Normal+Strategis, Sulit+Adaptif, Ahli+Strategis.

### Hasil pengukuran (versi ini)
`npm run evaluate:ai`-sejenis, 1000 meja × 4 rotasi kursi = 4000 pertandingan per kepribadian, keempat level di satu meja. Rata-rata peringkat (1 = terbaik; Jenderal menang = 1, kalah = 4):

| | Mudah | Normal | Sulit | Ahli |
|---|---|---|---|---|
| Agresif | 2.83 | 2.61 | 2.41 | 2.35 |
| Strategis | 2.93 | 2.73 | 2.32 | 2.17 |
| Adaptif | 2.81 | 2.73 | 2.42 | 2.19 |

Selain peringkat, harness mengukur per 100 keputusan: Joker dibuang sia-sia, pemecahan kombinasi, melewatkan langkah menang, hadiah Jenderal ke lawan, dan Jenderal yang dilewatkan (lihat `src/ai/simulation.js`). Angka ini hasil sampel acak yang deterministik (seed tetap), bukan jaminan kekuatan terhadap pemain manusia.

## Keterbatasan
- Tes browser memakai Chromium (Playwright) dengan viewport emulasi (360×640, 375×667, 390×844, 768×1024, 1280×800); belum diuji di perangkat fisik Android/iPhone, Safari, atau Firefox.
- Efek suara disintesis dan hanya diuji melalui kontrol logika dan konteks audio tiruan; kualitas bunyi di speaker nyata belum diverifikasi.
- AI heuristik (bukan pencarian pohon/pembelajaran mesin); "Ahli" kuat relatif terhadap level lain tetapi bukan solver optimal. Hasil mudah-ke-ahli adalah rata-rata statistik, bukan per pertandingan.
- Workflow GitHub Actions belum dijalankan di GitHub (hanya perintah yang sama dijalankan lokal dengan Node 22).
- Tidak ada multipemain online; statistik hanya lokal.

## Lisensi
MIT (lihat `LICENSE`).

## Catatan perubahan
- **1.1.0**: 4 tingkat kesulitan AI + pengaturan per AI, UI/UX lengkap (menu, pengaturan, panduan, animasi, indikator Jenderal, layar hasil, rematch), audio opsional, statistik per tingkat, tes AI/UI/browser, workflow dengan tes browser, `check-dist`.
  - Perbaikan: timer hasil pertandingan yang tertunda bisa memunculkan layar hasil / error setelah pemain keluar ke menu atau rematch; aksi ganda dicegah; deret Tangga panjang di tengah meja bisa keluar dari meja.
- **1.0.x (audit sebelumnya)**: urutan pemeriksaan Jenderal setelah Joker tunggal diperbaiki; penutupan pertandingan saat hanya satu pemain aktif tersisa; tes regresi ditambahkan.
