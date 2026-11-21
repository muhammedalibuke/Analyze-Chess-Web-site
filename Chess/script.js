import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@0.13.4/chess.js';
// Hamle sınıfları: etiket, simge (satranç notasyonundaki !!, !, ?, ?? işaretleri), renk ve açıklama.
// Renkler style.css'teki --genius, --sharp ... değişkenleriyle aynıdır.
const BOOK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 3h12a1 1 0 0 1 1 1v13H7a1 1 0 1 0 0 2h12v2H7a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2Z"/></svg>';
const CLASS_META = {
  genius:   { label: 'Parlak hamle',   symbol: '!!', color: '#2BD9E8', desc: 'Bulunması zor, fedakârlık içeren ve tek doğru olan hamle.' },
  sharp:    { label: 'Keskin hamle',   symbol: '!',  color: '#5C9BF5', desc: 'Tek iyi devam buydu; diğer hamleler avantajı kaçırırdı.' },
  optimum:  { label: 'En iyi hamle',   symbol: '★',  color: '#3DBE7A', desc: 'Motorun önerisiyle aynı ya da ona çok yakın, güçlü bir seçim.' },
  optimum2: { label: 'İyi hamle',      symbol: '✓',  color: '#93B85A', desc: 'Konumu bozmayan makul bir hamle; daha güçlü bir alternatif vardı.' },
  book:     { label: 'Açılış teorisi', symbol: '',   symbolHtml: BOOK_ICON, color: '#B08D5E', desc: 'Bilinen açılış teorisinde yer alan bir hamle.' },
  flaw:     { label: 'Hatalı hamle',   symbol: '?',  color: '#F0B03F', desc: 'Bu hamle avantajın bir kısmını kaybettirdi.' },
  fatal:    { label: 'Ciddi hata',     symbol: '??', color: '#EE5A52', desc: 'Bu hamle pozisyonu ciddi şekilde kötüleştirdi.' },
  unknown:  { label: 'Analiz yok',     symbol: '–',  color: '#6B7588', desc: 'Bu pozisyon için analiz verisi alınamadı (ağ hatası olabilir).' }
};
const CLASS_ORDER = ['genius', 'sharp', 'optimum', 'optimum2', 'book', 'flaw', 'fatal'];
const FALLBACK_DEPTH = 13;
const pgnInput = document.getElementById('pgnInput');
const commentaryCard = document.getElementById('commentaryCard');
const commBadge = document.getElementById('commBadge');
const commTitle = document.getElementById('commTitle');
const commText = document.getElementById('commText');
const commPvContainer = document.getElementById('commPvContainer');
const commPvText = document.getElementById('commPvText');
// =========================================================
// PARTİ YÜKLEME: dosya, metin ve hesaptan getir (Lichess / Chess.com)
// =========================================================
const tabButtons = [...document.querySelectorAll('.tab-btn[data-tab]')];
const tabFileBtn = document.getElementById('tabFileBtn');
const tabTextBtn = document.getElementById('tabTextBtn');
const tabAccountBtn = document.getElementById('tabAccountBtn');
const dropzoneLabel = document.getElementById('dropzoneLabel');
const fileStatusText = document.getElementById('fileStatusText');
const pgnFileInput = document.getElementById('pgnFile');
const fileGameList = document.getElementById('fileGameList');
const accountForm = document.getElementById('accountForm');
const accountInput = document.getElementById('accountInput');
const accountFetchBtn = document.getElementById('accountFetchBtn');
const accountStatus = document.getElementById('accountStatus');
const accountGameList = document.getElementById('accountGameList');
const platformButtons = [...document.querySelectorAll('.platform-btn')];

function selectTab(btn) {
  for (const b of tabButtons) {
    const on = b === btn;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
    document.getElementById(b.dataset.tab).classList.toggle('active', on);
  }
  // "Hesaptan getir" sekmesinde parti listeden seçilir; renk ve "Analiz et" düğmesi gizlenir
  document.getElementById('mainSetupPanel').dataset.tab = btn.dataset.tab;
}
for (const b of tabButtons) b.addEventListener('click', () => selectTab(b));
selectTab(tabButtons.find(b => b.classList.contains('active')) || tabButtons[0]);

// --- Ortak yardımcılar ---
function readHeaders(pgn) {
  const h = {};
  const re = /^\s*\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]\s*$/gm;
  let m;
  while ((m = re.exec(pgn))) h[m[1]] = m[2];
  return h;
}
// Bir PGN metnindeki partileri ayırır (her parti [Event ...] gibi bir başlık bloğuyla başlar)
function splitPgnGames(text) {
  const t = text.replace(/\r\n?/g, '\n').trim();
  if (!t) return [];
  const parts = t.split(/\n\s*\n(?=\s*\[)/);
  const games = [];
  let cur = '';
  for (const p of parts) {
    // Başlık bloğu ile hamleler arasında boş satır olduğu için başlık ve hamleler ayrı
    // parçalara düşer; hamle içermeyen parçayı bir sonrakine ekle.
    cur = cur ? cur + '\n\n' + p : p;
    const body = cur.replace(/^\s*\[.*\]\s*$/gm, '').trim();
    if (body) { games.push(cur.trim()); cur = ''; }
  }
  if (cur.trim()) games.push(cur.trim());
  return games;
}
function countMoves(pgn) {
  const body = pgn.replace(/^\s*\[.*\]\s*$/gm, '').replace(/\{[^}]*\}/g, '').replace(/\([^)]*\)/g, '');
  const nums = body.match(/(\d+)\.(?!\.)/g);
  return nums ? parseInt(nums[nums.length - 1], 10) : 0;
}
function resultFor(color, result) {
  if (result === '1/2-1/2') return 'draw';
  if (result === '1-0') return color === 'w' ? 'win' : 'loss';
  if (result === '0-1') return color === 'b' ? 'win' : 'loss';
  return null;
}
const RESULT_TEXT = { win: 'Kazandın', loss: 'Kaybettin', draw: 'Berabere' };
const SPEED_TEXT = { ultraBullet: 'Ultra bullet', bullet: 'Bullet', blitz: 'Blitz', rapid: 'Rapid', classical: 'Klasik', correspondence: 'Yazışmalı', daily: 'Günlük' };
function formatDate(ms) {
  if (!ms) return '';
  try { return new Date(ms).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch (e) { return ''; }
}
function formatClock(tc) {
  // Lichess: { initial: 180, increment: 2 } — Chess.com: "180+2" ya da "1/259200"
  if (!tc) return '';
  if (typeof tc === 'object') return `${Math.round(tc.initial / 60)}+${tc.increment}`;
  if (tc.includes('/')) return '';
  const [base, inc] = tc.split('+');
  return `${Math.round(parseInt(base, 10) / 60)}+${inc || 0}`;
}

// Seçilen partiyi analiz et; kullanıcının rengi biliniyorsa tahta onun tarafından gösterilsin
function analyzePgn(pgn, userColor) {
  pgnInput.value = pgn;
  if (userColor) {
    colorSelect.value = userColor === 'w' ? 'white' : 'black';
    colorSelect.dispatchEvent(new Event('change'));
  }
  runAnalysis();
}

// Parti listesi (dosyadaki partiler ve hesaptan gelen partiler aynı görünümü kullanır)
// item: { white, black, whiteElo, blackElo, result, userColor, meta, pgn }
function renderGameList(listEl, items) {
  listEl.innerHTML = '';
  for (const it of items) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'game-item';
    const outcome = it.userColor ? resultFor(it.userColor, it.result) : null;

    const mark = document.createElement('span');
    mark.className = 'game-result ' + (outcome || 'neutral');
    mark.textContent = outcome ? RESULT_TEXT[outcome] : (it.result && it.result !== '*' ? it.result : '');
    if (!mark.textContent) mark.classList.add('hidden');

    const main = document.createElement('span');
    main.className = 'game-main';
    const players = document.createElement('span');
    players.className = 'game-players';
    const side = (name, elo, color) => {
      const s = document.createElement('span');
      s.className = 'game-player';
      const sw = document.createElement('span');
      sw.className = 'swatch ' + (color === 'w' ? 'swatch-w' : 'swatch-b');
      s.appendChild(sw);
      const n = document.createElement('span');
      n.textContent = name + (elo ? ` (${elo})` : '');
      if (it.userColor === color) n.className = 'is-user';
      s.appendChild(n);
      return s;
    };
    players.append(side(it.white, it.whiteElo, 'w'), side(it.black, it.blackElo, 'b'));
    const meta = document.createElement('span');
    meta.className = 'game-meta';
    meta.textContent = it.meta;
    main.append(players, meta);

    const go = document.createElement('span');
    go.className = 'game-go';
    go.textContent = 'Analiz et';

    btn.append(mark, main, go);
    btn.addEventListener('click', () => analyzePgn(it.pgn, it.userColor));
    li.appendChild(btn);
    listEl.appendChild(li);
  }
}

// --- 1) Dosya yükleme ---
function isPgnFile(file) {
  return !!file && /\.pgn$/i.test(file.name);
}
function resetFileSelection() {
  pgnFileInput.value = '';
  fileStatusText.textContent = '';
  fileGameList.innerHTML = '';
}
function handleIncomingFile(file) {
  if (!file) return;
  selectTab(tabFileBtn);
  dropzoneLabel.classList.remove('dragover');
  if (!isPgnFile(file)) {
    showError(`"${file.name}" bir PGN dosyası değil. Uzantısı .pgn olan bir dosya seç (Lichess ve Chess.com'dan "PGN indir" ile alınabilir).`);
    resetFileSelection();
    return;
  }
  clearError();
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result || '');
    const games = splitPgnGames(text);
    fileGameList.innerHTML = '';
    if (games.length === 0) {
      showError(`"${file.name}" boş görünüyor.`);
      resetFileSelection();
      return;
    }
    if (games.length === 1) {
      pgnInput.value = games[0];
      const h = readHeaders(games[0]);
      const who = h.White || h.Black ? `${h.White || 'Beyaz'} – ${h.Black || 'Siyah'}, ` : '';
      fileStatusText.textContent = `✓ ${file.name}: ${who}${countMoves(games[0])} hamle. "Analiz et"e bas.`;
      return;
    }
    // Birden fazla parti: listeden seçtir
    pgnInput.value = '';
    fileStatusText.textContent = `✓ ${file.name}: ${games.length} parti bulundu. Analiz etmek istediğini seç.`;
    renderGameList(fileGameList, games.slice(0, 200).map(pgn => {
      const h = readHeaders(pgn);
      const metaParts = [h.Event && h.Event !== '?' ? h.Event : '', h.Date && !h.Date.startsWith('?') ? h.Date : '', `${countMoves(pgn)} hamle`].filter(Boolean);
      return { white: h.White || 'Beyaz', black: h.Black || 'Siyah', whiteElo: h.WhiteElo, blackElo: h.BlackElo, result: h.Result, userColor: null, meta: metaParts.join(', '), pgn };
    }));
  };
  reader.onerror = () => {
    showError(`"${file.name}" okunamadı. Tekrar dene.`);
    resetFileSelection();
  };
  reader.readAsText(file);
}

['dragenter', 'dragover'].forEach(ev => dropzoneLabel.addEventListener(ev, (e) => {
  e.preventDefault();
  dropzoneLabel.classList.add('dragover');
}));
['dragleave', 'drop'].forEach(ev => dropzoneLabel.addEventListener(ev, (e) => {
  e.preventDefault();
  dropzoneLabel.classList.remove('dragover');
}));
dropzoneLabel.addEventListener('drop', (e) => {
  const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  handleIncomingFile(file);
});
// Dosya sayfanın herhangi bir yerine bırakılırsa tarayıcı onu açmasın; yükleme kutusuna yönlendir
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  if (state) return;
  const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  handleIncomingFile(file);
});
pgnFileInput.addEventListener('change', () => handleIncomingFile(pgnFileInput.files[0]));

// --- 2) Hesaptan getir: Lichess / Chess.com ---
let platform = 'lichess';
function setPlatform(p) {
  platform = p;
  for (const b of platformButtons) {
    const on = b.dataset.platform === p;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
  }
  accountInput.placeholder = p === 'lichess'
    ? 'Lichess kullanıcı adı ya da parti linki'
    : 'Chess.com kullanıcı adı';
}
for (const b of platformButtons) b.addEventListener('click', () => setPlatform(b.dataset.platform));
try {
  const saved = JSON.parse(localStorage.getItem('satranc-hesap') || 'null');
  if (saved && saved.user) { accountInput.value = saved.user; setPlatform(saved.platform || 'lichess'); }
} catch (e) { /* depolama kapalı olabilir */ }

function setAccountStatus(msg, isError = false) {
  accountStatus.textContent = msg;
  accountStatus.classList.toggle('is-error', isError);
}

async function fetchLichessGames(user) {
  const url = `https://lichess.org/api/games/user/${encodeURIComponent(user)}?max=20&pgnInJson=true&opening=true&clocks=false&evals=false`;
  const r = await fetch(url, { headers: { Accept: 'application/x-ndjson' } });
  if (r.status === 404) throw new Error(`Lichess'te "${user}" adında bir kullanıcı yok.`);
  if (r.status === 429) throw new Error('Lichess şu an çok fazla istek alıyor. Bir dakika bekleyip tekrar dene.');
  if (!r.ok) throw new Error(`Lichess'e ulaşılamadı (HTTP ${r.status}).`);
  const lines = (await r.text()).trim().split('\n').filter(Boolean);
  const lower = user.toLowerCase();
  return lines.map(l => JSON.parse(l)).filter(g => g.variant === 'standard' && g.pgn && g.status !== 'aborted').map(g => {
    const wName = (g.players.white.user && g.players.white.user.name) || (g.players.white.aiLevel ? `Stockfish ${g.players.white.aiLevel}` : 'Anonim');
    const bName = (g.players.black.user && g.players.black.user.name) || (g.players.black.aiLevel ? `Stockfish ${g.players.black.aiLevel}` : 'Anonim');
    const userColor = wName.toLowerCase() === lower ? 'w' : bName.toLowerCase() === lower ? 'b' : null;
    const result = g.winner === 'white' ? '1-0' : g.winner === 'black' ? '0-1' : (g.status === 'draw' || g.status === 'stalemate' ? '1/2-1/2' : (g.status === 'started' ? '*' : '1/2-1/2'));
    const meta = [
      [SPEED_TEXT[g.speed] || g.speed, formatClock(g.clock)].filter(Boolean).join(' '),
      formatDate(g.createdAt),
      g.opening && g.opening.name
    ].filter(Boolean).join(', ');
    return { white: wName, black: bName, whiteElo: g.players.white.rating, blackElo: g.players.black.rating, result, userColor, meta, pgn: g.pgn };
  });
}

async function fetchLichessGameById(id) {
  const r = await fetch(`https://lichess.org/game/export/${id}?clocks=false&evals=false`);
  if (r.status === 404) throw new Error('Bu Lichess partisi bulunamadı. Linki kontrol et.');
  if (!r.ok) throw new Error(`Lichess'e ulaşılamadı (HTTP ${r.status}).`);
  return r.text();
}

async function fetchChessComGames(user) {
  const base = `https://api.chess.com/pub/player/${encodeURIComponent(user.toLowerCase())}`;
  const r = await fetch(`${base}/games/archives`);
  if (r.status === 404) throw new Error(`Chess.com'da "${user}" adında bir kullanıcı yok.`);
  if (r.status === 429) throw new Error('Chess.com şu an çok fazla istek alıyor. Biraz bekleyip tekrar dene.');
  if (!r.ok) throw new Error(`Chess.com'a ulaşılamadı (HTTP ${r.status}).`);
  const archives = (await r.json()).archives || [];
  const games = [];
  // En yeni aydan geriye doğru, 20 parti toplanana kadar (en fazla 3 ay)
  for (let i = archives.length - 1; i >= 0 && i >= archives.length - 3 && games.length < 20; i--) {
    const rr = await fetch(archives[i]);
    if (!rr.ok) break;
    const month = ((await rr.json()).games || []).filter(g => g.rules === 'chess' && g.pgn);
    games.push(...month.reverse());
  }
  const lower = user.toLowerCase();
  return games.slice(0, 20).map(g => {
    const userColor = g.white.username.toLowerCase() === lower ? 'w' : g.black.username.toLowerCase() === lower ? 'b' : null;
    const result = readHeaders(g.pgn).Result || '*';
    const h = readHeaders(g.pgn);
    const opening = h.ECOUrl ? decodeURIComponent(h.ECOUrl.split('/').pop()).replace(/-/g, ' ') : '';
    const meta = [
      [SPEED_TEXT[g.time_class] || g.time_class, formatClock(g.time_control)].filter(Boolean).join(' '),
      formatDate(g.end_time * 1000),
      opening
    ].filter(Boolean).join(', ');
    return { white: g.white.username, black: g.black.username, whiteElo: g.white.rating, blackElo: g.black.rating, result, userColor, meta, pgn: g.pgn };
  });
}

accountForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();
  const q = accountInput.value.trim();
  accountGameList.innerHTML = '';
  if (!q) { setAccountStatus('Bir kullanıcı adı yaz.', true); accountInput.focus(); return; }

  // Lichess parti linki → doğrudan o partiyi analiz et
  const lichessLink = q.match(/lichess\.org\/([a-zA-Z0-9]{8})/);
  if (lichessLink) {
    accountFetchBtn.disabled = true;
    setAccountStatus('Parti getiriliyor…');
    try {
      const pgn = await fetchLichessGameById(lichessLink[1]);
      setAccountStatus('');
      analyzePgn(pgn, null);
    } catch (err) {
      setAccountStatus(err.message, true);
    } finally {
      accountFetchBtn.disabled = false;
    }
    return;
  }
  if (/chess\.com\//.test(q)) {
    setAccountStatus('Chess.com parti linkleri doğrudan açılamıyor. Kullanıcı adını yaz, partiyi listeden seç.', true);
    setPlatform('chesscom');
    return;
  }
  if (!/^[\w-]{2,30}$/.test(q)) { setAccountStatus('Kullanıcı adı sadece harf, rakam, - ve _ içerebilir.', true); return; }

  accountFetchBtn.disabled = true;
  setAccountStatus(platform === 'lichess' ? "Lichess'ten son partiler getiriliyor…" : "Chess.com'dan son partiler getiriliyor…");
  try {
    const items = platform === 'lichess' ? await fetchLichessGames(q) : await fetchChessComGames(q);
    if (items.length === 0) {
      setAccountStatus('Bu hesapta analiz edilebilecek (standart satranç) parti bulunamadı.', true);
    } else {
      setAccountStatus(`Son ${items.length} parti. Analiz etmek istediğine tıkla.`);
      renderGameList(accountGameList, items);
      try { localStorage.setItem('satranc-hesap', JSON.stringify({ platform, user: q })); } catch (e2) { /* yok say */ }
    }
  } catch (err) {
    setAccountStatus(err.message || 'Partiler getirilemedi. İnternet bağlantını kontrol et.', true);
  } finally {
    accountFetchBtn.disabled = false;
  }
});

const ENGINE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js'; 
const MATE_SCORE = 10000;
const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const CRITICAL_GAP = 150;

// [DÜZELTME #4] Kayıp hesaplanırken puanlar ±EVAL_CLAMP aralığına sıkıştırılır.
// Farklı kaynaklar "mat" ve "kesin kazanç" durumlarını farklı büyüklükte sayılarla
// ifade ediyor (Stockfish mat ≈ 10000, tablebase kazancı TB_WIN_CP, ChessDB kendi
// ölçeği). Sıkıştırma olmadan "mat 3" → "tablebase kazancı" geçişi binlerce
// santipiyonluk sahte bir kayıp gibi görünüp "Ciddi Hata" sayılıyordu.
// (cpToWinPercent zaten aynı ±1000 sınırını kullanıyor.)
const EVAL_CLAMP = 1000;

// [DÜZELTME #2] Endgame tablebase sonucu (kazanç/kayıp/beraberlik) santipiyona
// çevrilirken kullanılan değer. "Mat" eşiği olan 8000'in altında tutuldu ki
// ekranda yanlışlıkla "Mat" yazmasın.
const TB_WIN_CP = 5000;

// [DÜZELTME #5] Gerçek açılış teorisi: Lichess'in açık lisanslı (CC0) açılış listesi.
// ~3800 adlandırılmış açılış hattı; bu hatlardaki her pozisyon "kitap" kabul edilir.
const OPENINGS_BASE_URL = 'https://cdn.jsdelivr.net/gh/lichess-org/chess-openings@master/';
const OPENINGS_FILES = ['a.tsv', 'b.tsv', 'c.tsv', 'd.tsv', 'e.tsv'];
// Veritabanında adı geçen ama motorun kötü bulduğu açılışlar da var (ör. 2.Qh5 "Parham Attack",
// 2.Ke2 "Bongcloud"). Bu yüzden kitaptaki bir hamle ancak en fazla bu kadar kaybettiriyorsa
// "Açılış Teorisi" sayılır; daha pahalıysa normal sınıflandırılır (Hatalı / Ciddi Hata vb.).
const BOOK_MAX_LOSS = 80;
const SAMPLE_PGN = `[Event "Opera Game"]
[White "Paul Morphy"]
[Black "Duke of Brunswick & Count Isouard"]
[Result "1-0"]
1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7
8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8
13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`;
// [DÜZELTME #5] Eski elle yazılmış OPENING_BOOK kaldırıldı: yalnızca 2 pozisyon
// içeriyordu ve 1.e4 sonrasındaki puanın işareti de yanlıştı (Siyah'a +0.40 veriyordu).
// Yerine aşağıdaki loadOpeningDb() kullanılıyor.

// Pozisyonu hamle sayaçlarından ve en passant alanından bağımsız bir anahtara çevirir
// (taşlar + sıra + rok hakları). Aynı pozisyona farklı hamle sırasıyla gelinse de eşleşir.
function positionKey(fen) {
  return fen.split(' ').slice(0, 3).join(' ');
}

let openingDbPromise = null;
// Açılış veritabanını bir kez indirip { positions: Set, names: Map } olarak önbelleğe alır.
// İndirme başarısız olursa null döner; analiz yine çalışır, sadece "kitap" etiketi verilmez.
function loadOpeningDb() {
  if (!openingDbPromise) {
    openingDbPromise = Promise.all(
      OPENINGS_FILES.map(f => fetch(OPENINGS_BASE_URL + f).then(r => {
        if (!r.ok) throw new Error(`${f}: HTTP ${r.status}`);
        return r.text();
      }))
    )
      .then(texts => buildOpeningDb(texts))
      .catch(err => {
        console.warn('Açılış veritabanı yüklenemedi, kitap hamlesi tespiti kapalı:', err.message);
        openingDbPromise = null; // bir sonraki analizde tekrar denensin
        return null;
      });
  }
  return openingDbPromise;
}

function buildOpeningDb(tsvTexts) {
  const positions = new Set();
  const names = new Map();      // positionKey -> { eco, name }
  const fenByPrefix = new Map(); // ortak hamle öneklerini tekrar oynamamak için önbellek
  for (const text of tsvTexts) {
    const lines = text.split('\n');
    for (let li = 1; li < lines.length; li++) { // ilk satır başlık (eco, name, pgn)
      const cols = lines[li].split('\t');
      if (cols.length < 3) continue;
      const [eco, name, pgn] = cols;
      const sans = pgn.trim().split(/\s+/).filter(t => !/^\d+\.+$/.test(t));
      // Önbellekteki en uzun öneki bul, oradan devam et
      let start = sans.length;
      while (start > 0 && !fenByPrefix.has(sans.slice(0, start).join(' '))) start--;
      const g = start > 0 ? new Chess(fenByPrefix.get(sans.slice(0, start).join(' '))) : new Chess();
      let ok = true;
      for (let k = start; k < sans.length; k++) {
        if (!g.move(sans[k])) { ok = false; break; }
        const fen = g.fen();
        fenByPrefix.set(sans.slice(0, k + 1).join(' '), fen);
        positions.add(positionKey(fen));
      }
      if (!ok) continue;
      const finalFen = start === sans.length ? fenByPrefix.get(sans.join(' ')) : g.fen();
      if (finalFen) names.set(positionKey(finalFen), { eco, name });
    }
  }
  return { positions, names };
}
const analyzeBtn = document.getElementById('analyzeBtn');
const sampleBtn = document.getElementById('sampleBtn');
const colorSelect = document.getElementById('colorSelect');
const statusRow = document.getElementById('statusRow');
const statusLine = document.getElementById('statusLine');
const progressFill = document.getElementById('progressFill');
const errorMsg = document.getElementById('errorMsg');
const reviewLayout = document.getElementById('reviewLayout');
const boardEl = document.getElementById('board');
const arrowOverlay = document.getElementById('arrowOverlay');
const coordsTop = document.getElementById('coordsTop');
const coordsBottom = document.getElementById('coordsBottom');
const coordsLeft = document.getElementById('coordsLeft');
const coordsRight = document.getElementById('coordsRight');
const plyLabel = document.getElementById('plyLabel');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const whiteAccEl = document.getElementById('whiteAcc');
const blackAccEl = document.getElementById('blackAcc');
const moveListEl = document.getElementById('moveList');

// "Örnek partiyi incele": örnek partiyi metin kutusuna koyup doğrudan analiz et
sampleBtn.addEventListener('click', () => {
  pgnInput.value = SAMPLE_PGN;
  document.getElementById('tabTextBtn').click();
  runAnalysis();
});

function showError(msg) { errorMsg.textContent = msg; errorMsg.classList.add('active'); }
function clearError() { errorMsg.classList.remove('active'); errorMsg.textContent = ''; }
function sanitizePgn(raw) {
  let s = raw.replace(/\r\n?/g, '\n');
  // chess.js, başlık satırları ([White "..."] vb.) ile hamleler arasında boş satır ister.
  // Yapıştırılan PGN'lerde bu boş satır çoğu zaman yok; o zaman PGN okunamıyor, yedek
  // ayrıştırıcıya düşülüyor ve oyuncu adları gibi başlık bilgileri kayboluyordu.
  const lines = s.split('\n');
  let hi = 0;
  while (hi < lines.length && /^\s*\[.*\]\s*$/.test(lines[hi])) hi++;
  if (hi > 0 && hi < lines.length && lines[hi].trim() !== '') lines.splice(hi, 0, '');
  s = lines.join('\n');
  let prev;
  do { prev = s; s = s.replace(/\([^()]*\)/g, ''); } while (s !== prev);
  s = s.replace(/\{[^}]*\}/g, '');
  s = s.replace(/\$\d+/g, '');
  return s.trim();
}
const TR_PIECE_MAP = { 'A': 'N', 'F': 'B', 'V': 'Q', 'K': 'R', 'Ş': 'K', 'S': 'K' };
function trTokenToEnglish(tok) {
  if (/^(O-O-O|0-0-0|O-O|0-0)/.test(tok)) return tok.replace(/0/g, 'O');
  let out = tok;
  if (TR_PIECE_MAP[out[0]]) out = TR_PIECE_MAP[out[0]] + out.slice(1);
  out = out.replace(/=([AFVKŞS])/, (m, p1) => '=' + TR_PIECE_MAP[p1]);
  return out;
}
function isValidMoveShape(tok) {
  if (/^(O-O-O|0-0-0)[+#]?$/.test(tok)) return true;
  if (/^(O-O|0-0)[+#]?$/.test(tok)) return true;
  return /^[A-ZŞ]?[a-h]?[1-8]?x?[a-h][1-8](=[A-ZŞ])?[+#]?$/.test(tok);
}
function splitTwoMoves(segment) {
  for (let k = 2; k < segment.length; k++) {
    const a = segment.slice(0, k), b = segment.slice(k);
    if (isValidMoveShape(a) && isValidMoveShape(b)) return [a, b];
  }
  if (isValidMoveShape(segment)) return [segment, null];
  return null;
}
function convertTurkishCompact(raw) {
  const s = raw.trim();
  let num = 1, anchors = [], searchFrom = 0;
  while (true) {
    const anchor = num + '. ';
    const idx = s.indexOf(anchor, searchFrom);
    if (idx === -1) break;
    anchors.push({ num, idx, len: anchor.length });
    searchFrom = idx + anchor.length;
    num++;
  }
  if (anchors.length === 0) return null;
  const out = [];
  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i];
    const contentStart = a.idx + a.len;
    const contentEnd = i + 1 < anchors.length ? anchors[i + 1].idx : s.length;
    let segment = s.slice(contentStart, contentEnd).trim();
    segment = segment.replace(/\s*(1-0|0-1|1\/2-1\/2|\*)\s*$/, '');
    segment = segment.replace(/\s+/g, '');
    if (!segment) continue;
    const split = splitTwoMoves(segment);
    if (!split) return null;
    const [whiteTr, blackTr] = split;
    out.push(a.num + '. ' + trTokenToEnglish(whiteTr));
    if (blackTr) out.push(trTokenToEnglish(blackTr));
  }
  return out.join(' ');
}
function parsePgn(raw) {
  const cleaned = sanitizePgn(raw);
  let game = new Chess();
  let ok = game.load_pgn(cleaned, { sloppy: true });
  if (!ok) {
    const converted = convertTurkishCompact(raw);
    if (converted) {
      game = new Chess();
      ok = game.load_pgn(converted, { sloppy: true });
    }
  }
  if (!ok) throw new Error('PGN ayrıştırılamadı.');
  const headers = game.header();
  const historyVerbose = game.history({ verbose: true });
  if (historyVerbose.length === 0) throw new Error('PGN içinde hamle bulunamadı.');
  const replay = new Chess();
  const fens = [replay.fen()];
  for (const m of historyVerbose) {
    replay.move(m.san);
    fens.push(replay.fen());
  }
  return { headers, moves: historyVerbose, fens };
}
const ANALYZE_TIMEOUT_BASE_MS = 15000;   // taban süre
const ANALYZE_TIMEOUT_PER_DEPTH_MS = 1500; // her derinlik birimi için ek süre

class EnginePool {
  constructor() {
    this.size = 4;
    this.workers = [];
    this.readyPromises = [];
    this.initialized = false;
    this.blobURL = null;          // aktif Blob URL — sızıntıyı önlemek için takip ediliyor
    this.availableThreads = 1;
  }
  updatePoolSizeByDepth(depth) {
    if (depth >= 18) this.size = 2;
    else this.size = 4;
  }
  // Tüm worker'ları kapatır ve Blob URL'i serbest bırakır (bellek sızıntısını önler)
  terminateAll() {
    this.workers.forEach(w => {
      try { w.worker.terminate(); } catch (e) { /* zaten kapanmış olabilir */ }
    });
    this.workers = [];
    this.readyPromises = [];
    if (this.blobURL) {
      URL.revokeObjectURL(this.blobURL);
      this.blobURL = null;
    }
  }
  async init(depth) {
    this.updatePoolSizeByDepth(depth);
    this.terminateAll();
    const resp = await fetch(ENGINE_URL);
    const code = await resp.text();
    const blob = new Blob([code], { type: 'application/javascript' });
    this.blobURL = URL.createObjectURL(blob);
    this.availableThreads = Math.max(1, Math.floor((navigator.hardwareConcurrency || 4) / this.size));
    this.readyPromises = [];
    for (let i = 0; i < this.size; i++) {
      this.readyPromises.push(this.spawnWorker(i));
    }
    await Promise.all(this.readyPromises);
    this.initialized = true;
  }
  // Belirli bir slot için worker oluşturur, UCI el sıkışmasını yapar ve hazır olunca resolve eder.
  spawnWorker(slotIndex) {
    const worker = new Worker(this.blobURL);
    const entry = { worker, busy: false };
    this.workers[slotIndex] = entry;
    return new Promise((resolve) => {
      let uciSeen = false;
      worker.onmessage = (e) => {
        if (e.data === 'uciok') {
          uciSeen = true;
          worker.postMessage(`setoption name Threads value ${this.availableThreads}`);
          worker.postMessage('setoption name Hash value 32');
          // [DÜZELTME #3] İkinci en iyi hamlenin puanı (score2) için motor 2 varyant hesaplamalı.
          // Bu ayar olmadan "multipv 2" satırı hiç gelmiyor, score2 hep null kalıyordu.
          worker.postMessage('setoption name MultiPV value 2');
          worker.postMessage('isready');
        } else if (e.data === 'readyok' && uciSeen) resolve();
      };
      worker.onerror = (err) => {
        console.error('Motor worker genel hata verdi:', err.message || err);
      };
      worker.postMessage('uci');
    });
  }
  // Çöken/zaman aşımına uğrayan bir worker'ı sessizce yeniden oluşturur (havuz kendini onarır)
  async replaceWorker(slotIndex) {
    const old = this.workers[slotIndex];
    if (old) {
      try { old.worker.terminate(); } catch (e) { /* yok say */ }
    }
    await this.spawnWorker(slotIndex);
    this.workers[slotIndex].busy = false;
  }
  getFreeWorker() {
    return this.workers.find(w => !w.busy);
  }
  async analyze(fen, depth) {
    // Boş bir worker bulunana kadar bekle. Önceden boş worker yoksa doğrudan
    // workers[0]'a düşülüyordu; bu, o worker hâlâ önceki bir pozisyonu analiz
    // ediyorsa iki isteğin birbirine karışıp YANLIŞ sonuç dönmesine yol açabiliyordu.
    let finalWObj = this.getFreeWorker();
    const waitStart = Date.now();
    while (!finalWObj) {
      if (Date.now() - waitStart > 20000) {
        throw new Error('Uygun motor worker bulunamadı (havuz dolu).');
      }
      await new Promise(r => setTimeout(r, 40));
      finalWObj = this.getFreeWorker();
    }

    return new Promise((resolve, reject) => {
      const slotIndex = this.workers.indexOf(finalWObj);
      finalWObj.busy = true;
      const worker = finalWObj.worker;
      const lastScores = {};
      const firstMoves = {}; // multipv sırası -> o varyantın ilk hamlesi (UCI)
      let currentPv = "";
      let settled = false;

      const cleanup = () => {
        clearTimeout(timeoutId);
        worker.removeEventListener('message', handler);
        worker.removeEventListener('error', onWorkerError);
      };

      // Zaman aşımı: "bestmove" belirli sürede gelmezse bu pozisyonu hatayla sonlandır
      // ve worker'ı arka planda yeniden oluştur ki havuz kilitlenmesin.
      const timeoutMs = ANALYZE_TIMEOUT_BASE_MS + depth * ANALYZE_TIMEOUT_PER_DEPTH_MS;
      const timeoutId = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        console.warn(`Motor zaman aşımına uğradı (derinlik ${depth}, ${timeoutMs}ms). Worker #${slotIndex} yenileniyor.`);
        this.replaceWorker(slotIndex).catch(e => console.error('Worker yenilenemedi:', e));
        reject(new Error('Motor zaman aşımına uğradı.'));
      }, timeoutMs);

      // Worker çökerse (OOM, script hatası vb.) bu pozisyonu hatayla sonlandır ve worker'ı yenile.
      const onWorkerError = (err) => {
        if (settled) return;
        settled = true;
        cleanup();
        console.error('Motor worker çalışırken çöktü:', err.message || err);
        this.replaceWorker(slotIndex).catch(e => console.error('Worker yenilenemedi:', e));
        reject(new Error('Motor çalışırken hata oluştu.'));
      };

      const handler = (e) => {
        const line = e.data;
        if (typeof line === 'string') {
          if (line.startsWith('info')) {
            const mpvMatch = line.match(/multipv (\d+)/);
            const scoreMatch = line.match(/score (cp|mate) (-?\d+)/);
            const pvMatch = line.match(/ pv (.+)/);
            if (scoreMatch) {
              const idx = mpvMatch ? parseInt(mpvMatch[1], 10) : 1;
              lastScores[idx] = { type: scoreMatch[1], value: parseInt(scoreMatch[2], 10) };
            }
            if (pvMatch) {
              const idx = mpvMatch ? parseInt(mpvMatch[1], 10) : 1;
              // Stockfish.js satır sonuna "bmc 1.87" gibi teknik bir değer ekliyor; varyanta karışmasın
              const pvMoves = pvMatch[1].replace(/\s+bmc\b.*$/, '').trim();
              firstMoves[idx] = pvMoves.split(' ')[0];
              if (idx === 1) currentPv = pvMoves;
            }
          } else if (line.startsWith('bestmove')) {
            if (settled) return;
            settled = true;
            cleanup();
            finalWObj.busy = false;
            const parts = line.split(' ');
            // [DÜZELTME #4] Motorun puanladığı her hamlenin puanı (sırası gelen tarafa göre).
            const moveScores = {};
            for (const k of Object.keys(lastScores)) {
              if (firstMoves[k]) moveScores[firstMoves[k]] = lastScores[k];
            }
            resolve({
              score: lastScores[1] || null,
              score2: lastScores[2] || null,
              bestMoveUci: parts[1],
              pv: currentPv,
              moveScores,
              source: 'stockfish_local'
            });
          }
        }
      };
      worker.addEventListener('message', handler);
      worker.addEventListener('error', onWorkerError);
      // [DÜZELTME #4] Her pozisyondan önce motorun hafızasını (hash) temizle. Aksi halde
      // sonuç, o worker'ın daha önce hangi pozisyonları analiz ettiğine bağlı oluyor ve
      // aynı parti iki kez analiz edildiğinde farklı doğruluk oranları çıkabiliyordu.
      worker.postMessage('ucinewgame');
      worker.postMessage('position fen ' + fen);
      worker.postMessage('go depth ' + depth);
    });
  }
}
const pool = new EnginePool();
function normalizeScore(score, sideToMoveIsWhite) {
  if (!score) return null;
  let cp;
  if (score.type === 'cp') cp = score.value;
  else {
    const m = score.value;
    cp = m > 0 ? (MATE_SCORE - (m - 1) * 10) : (-MATE_SCORE - (m + 1) * 10);
  }
  return sideToMoveIsWhite ? cp : -cp;
}
// Puanı "sırası gelen tarafın" bakış açısıyla santipiyona çevirir (işaret çevirmeden).
function scoreForSideToMove(score) {
  return normalizeScore(score, true);
}
function clampEval(cp) {
  return Math.max(-EVAL_CLAMP, Math.min(EVAL_CLAMP, cp));
}
function uciToSan(fen, uciMove) {
  if (!uciMove || uciMove === '(none)') return null;
  const g = new Chess(fen);
  const from = uciMove.slice(0, 2), to = uciMove.slice(2, 4);
  const promo = uciMove.length > 4 ? uciMove.slice(4, 5) : undefined;
  const verboseMoves = g.moves({ verbose: true });
  const match = verboseMoves.find(mv => mv.from === from && mv.to === to && (!promo || mv.promotion === promo));
  return match ? match.san : uciMove;
}
function cpToWinPercent(cp) {
  const capped = Math.max(-1000, Math.min(1000, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * capped)) - 1);
}
// Tek bir hamlenin doğruluğu (Lichess'in formülü, lila: AccuracyPercent.scala).
// winBefore / winAfter: hamleyi yapanın kazanma yüzdesi (0–100), hamleden önce ve sonra.
function moveAccuracy(winBefore, winAfter) {
  if (winAfter >= winBefore) return 100;
  const diff = winBefore - winAfter;
  const raw = 103.1668100711649 * Math.exp(-0.04354415386753951 * diff) - 3.166924740191411;
  return Math.max(0, Math.min(100, raw + 1)); // +1: analizdeki belirsizlik payı (Lichess'te de var)
}

function isSacrifice(move) {
  if (!move.captured) return false;
  const movingVal = PIECE_VALUE[move.piece] || 0;
  const capturedVal = PIECE_VALUE[move.captured] || 0;
  return (movingVal - capturedVal) >= 2;
}

function classifyMove({ loss, gapBefore, isBest, sac, isBook }) {
  // [DÜZELTME #5] Eskiden "ilk 8 hamlede 100 cp'den az kaybettiren her hamle" kitap
  // sayılıyordu (1.e4 e5 2.Qh5 bile). Artık yalnızca hamle sonrası pozisyon gerçek
  // açılış veritabanında varsa 'book' veriliyor.
  if (isBook) {
    return 'book';
  }

  if (loss <= 15) {
    if (isBest && sac && gapBefore !== null && gapBefore >= CRITICAL_GAP) return 'genius';
    if (isBest && gapBefore !== null && gapBefore >= CRITICAL_GAP) return 'sharp';
    return 'optimum';
  }
  if (loss <= 40) return 'optimum';
  if (loss <= 95) return 'optimum2';
  if (loss <= 190) return 'flaw';
  return 'fatal';
}


// Oyun doğruluğu — Lichess'in yöntemi:
//  1) Her hamle için doğruluk (moveAccuracy).
//  2) Ağırlıklı ortalama: ağırlık, o andaki kazanma yüzdesinin oynaklığı (kayan pencerede standart
//     sapma, 0.5–12 arası). Keskin anlardaki hamleler daha çok, sakin anlardakiler daha az sayılır.
//  3) Harmonik ortalama: tek bir büyük hata sonucu sert düşürür.
//  Sonuç = (ağırlıklı ortalama + harmonik ortalama) / 2.
// Eskiden basit aritmetik ortalama kullanılıyor, kitap hamleleri de hariç tutuluyordu; birkaç
// büyük hata bile oranı pek düşürmediği için sonuçlar gerçekçi olmayacak kadar yüksek çıkıyordu.
function stdDev(arr) {
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) * (b - m), 0) / arr.length);
}
function computeAccuracies() {
  const n = state.moves.length;
  if (n === 0) return { white: null, black: null };
  // Her pozisyon için Beyaz'ın kazanma yüzdesi (oynaklık ağırlıkları için)
  const wins = [];
  let last = 0;
  for (let i = 0; i < state.evals.length; i++) {
    if (state.evals[i] !== null && state.evals[i] !== undefined) last = state.evals[i];
    wins.push(cpToWinPercent(last));
  }
  const windowSize = Math.min(8, Math.max(2, Math.floor(state.evals.length / 10)));
  const windows = [];
  for (let k = 0; k < windowSize - 2 && k < n; k++) windows.push(wins.slice(0, windowSize));
  for (let k = 0; k + windowSize <= wins.length; k++) windows.push(wins.slice(k, k + windowSize));
  const weights = windows.map(w => Math.min(12, Math.max(0.5, stdDev(w))));

  const per = { w: [], b: [] };
  for (let i = 0; i < n; i++) {
    const m = state.perMove[i];
    if (!m || m.cls === 'unknown' || m.bestCp === null || m.playedCp === null) continue;
    const acc = moveAccuracy(cpToWinPercent(m.bestCp), cpToWinPercent(m.playedCp));
    per[m.color].push({ acc, weight: weights[i] !== undefined ? weights[i] : 0.5 });
  }
  const gameAccuracy = (list) => {
    if (list.length === 0) return null;
    const wSum = list.reduce((a, x) => a + x.weight, 0);
    const weighted = list.reduce((a, x) => a + x.acc * x.weight, 0) / wSum;
    const harmonic = list.length / list.reduce((a, x) => a + 1 / Math.max(x.acc, 1), 0);
    return (weighted + harmonic) / 2;
  };
  return { white: gameAccuracy(per.w), black: gameAccuracy(per.b) };
}

async function runAnalysis() {
    clearError();
    
    const raw = pgnInput.value;
    const mainSetupPanel = document.getElementById('mainSetupPanel');
    
    console.log("Analiz başlatiliyor...");
    analyzeBtn.disabled = true;
    statusRow.classList.add('active');
    statusLine.textContent = 'Motor hazırlanıyor...';

    // [DÜZELTME #5] Açılış veritabanını motorla aynı anda indirmeye başla (ilk seferden sonra önbellekte).
    const openingDbLoad = loadOpeningDb();

    try {
        // Motoru başlat
        await pool.init(FALLBACK_DEPTH);

        const parsed = parsePgn(raw);
        
        statusLine.textContent = 'Analiz devam ediyor: ' + parsed.moves.length + ' hamle.';
        
        const fens = parsed.fens;
        const depth = FALLBACK_DEPTH;

        // Havuzdaki TÜM worker'ları paralel kullanan kuyruk mantığı:
        // her worker kendi döngüsünde bir sonraki boş pozisyonu alır, böylece
        // 4 worker açıksa 4 pozisyon aynı anda analiz edilir (öncekinde
        // pozisyonlar tek tek sırayla bekleniyordu, havuzun 3-4 worker'ı boşta duruyordu).
        const results = new Array(fens.length);
        let nextIndex = 0;
        let completedCount = 0;
        let localCount = 0; // bulutta bulunmayıp bu cihazda Stockfish ile hesaplanan pozisyonlar
        const concurrency = Math.max(1, pool.workers.length);

        async function analysisWorkerLoop() {
            while (true) {
                const idx = nextIndex++;
                if (idx >= fens.length) return;
                try {
                    // Önce hibrit bulut analizini dene (Derinlik 20-50 arası sonuç döndürür)
                    let cloudRes = await getHybridAnalysis(fens[idx]);
                    
                    if (cloudRes) {
                        results[idx] = {
                            score: cloudRes.score,
                            score2: cloudRes.score2 || null,
                            bestMoveUci: cloudRes.bestMoveUci,
                            pv: cloudRes.pv || '',
                            moveScores: cloudRes.moveScores || {},
                            source: cloudRes.source
                        };
                    } else {
                        // Bulutta veri yoksa yerel Stockfish motoruna düş
                        localCount++;
                        results[idx] = await pool.analyze(fens[idx], depth);
                    }
                } catch (err) {
                    console.warn(`Pozisyon ${idx} analiz edilemedi, yerel motora geçiliyor... ${err.message}`);
                    try {
                        results[idx] = await pool.analyze(fens[idx], depth);
                    } catch (fallbackErr) {
                        results[idx] = { score: null, score2: null, bestMoveUci: null, pv: '' };
                    }
                }
                completedCount++;
                progressFill.style.width = `${Math.round((completedCount / fens.length) * 100)}%`;
                statusLine.textContent = `Analiz ediliyor: ${completedCount}/${fens.length} pozisyon` +
                    (localCount ? ` (${localCount} tanesi çevrim içi veritabanında yok, bu cihazda hesaplanıyor; biraz sürebilir)` : '');
            }
        }

        await Promise.all(Array.from({ length: concurrency }, () => analysisWorkerLoop()));

        // --- State güncelleme işlemleri ---
        // Burada 'parsed' değişkenini güvenle kullanabilirsin
        const evals = [];
        const bestMoveSanAt = [];
        for(let i = 0; i < fens.length; i++) {
            const sideToMoveIsWhite = fens[i].split(' ')[1] === 'w';
            evals.push(normalizeScore(results[i].score, sideToMoveIsWhite));
            bestMoveSanAt.push(uciToSan(fens[i], results[i].bestMoveUci));
        }

        // [DÜZELTME #5] Açılış veritabanı analizle paralel yükleniyordu; burada sonucunu al.
        const openingDb = await openingDbLoad;

        const perMove = [];
        for (let i = 0; i < parsed.moves.length; i++) {
            const mv = parsed.moves[i];
            const moverIsWhite = mv.color === 'w';
            const res = results[i];
            const playedUci = mv.from + mv.to + (mv.promotion || '');

            // [DÜZELTME #4] Hamlenin kaybı mümkünse TEK BİR kaynaktan hesaplanır:
            // i. pozisyonun analizi hem en iyi hamlenin hem de (listede varsa) oynanan
            // hamlenin puanını içerir (ChessDB tüm hamleleri, Lichess/Stockfish ilk 2-3
            // hamleyi, tablebase tüm hamleleri verir). Eskiden kayıp, i. ve i+1. pozisyonun
            // puan farkından bulunuyordu; bu iki pozisyon farklı motorlardan geldiğinde
            // (ör. ChessDB → derinlik 13 Stockfish) motorlar arasındaki görüş farkı
            // "hata" gibi görünüyordu. Oynanan hamle listede yoksa eski yönteme düşülür.
            // Tüm puanlar burada hamleyi yapan tarafın bakış açısındadır.
            const bestCpRaw = res && res.score ? scoreForSideToMove(res.score) : null;
            let playedCpRaw = null;
            if (res && res.moveScores && res.moveScores[playedUci]) {
                playedCpRaw = scoreForSideToMove(res.moveScores[playedUci]);
            } else if (evals[i + 1] !== null) {
                playedCpRaw = moverIsWhite ? evals[i + 1] : -evals[i + 1];
            }

            // Bulut API'leri ve yerel motor bir pozisyon için sonuç döndüremediyse
            // hamle 'unknown' olarak işaretlenir (sessizce "mükemmel" sayılmaz).
            const analysisMissing = bestCpRaw === null || playedCpRaw === null;
            const bestCp = analysisMissing ? null : clampEval(bestCpRaw);
            const playedCp = analysisMissing ? null : clampEval(playedCpRaw);
            const cpLoss = analysisMissing ? 0 : Math.max(0, bestCp - playedCp);

            // [DÜZELTME #3] En iyi ve ikinci en iyi hamle arasındaki fark ("tek hamle" mi?).
            // Artık bulut kaynakları da score2 döndürdüğü için bu değer gerçekten hesaplanıyor.
            let gapBefore = null;
            if (!analysisMissing && res.score && res.score2) {
                gapBefore = Math.abs(clampEval(scoreForSideToMove(res.score)) - clampEval(scoreForSideToMove(res.score2)));
            }

            // [DÜZELTME #3] "En iyi hamle mi?" artık motorun önerdiği hamleyle doğrudan
            // karşılaştırılıyor (eskiden sadece cpLoss <= 10'a bakılıyordu).
            const isBest = !analysisMissing && (playedUci === res.bestMoveUci || cpLoss <= 5);

            // [DÜZELTME #5] Hamle sonrası pozisyon açılış veritabanında mı?
            const inOpeningDb = !!openingDb && openingDb.positions.has(positionKey(fens[i + 1]));
            const isBook = inOpeningDb && (analysisMissing || cpLoss <= BOOK_MAX_LOSS);

            const cls = isBook ? 'book' : analysisMissing ? 'unknown' : classifyMove({ 
              loss: cpLoss, 
              gapBefore: gapBefore, 
              isBest, 
              sac: isSacrifice(mv),
              isBook
            });

            perMove.push({ 
              san: mv.san, 
              color: mv.color, 
              from: mv.from, 
              to: mv.to, 
              cls, 
              bestSan: bestMoveSanAt[i],
              pv: res ? res.pv : '',   // Motorun önerdiği en iyi varyant
              evalBefore: evals[i],    // Hamle yapılmadan önceki tahta değerlendirmesi (Beyaz'a göre)
              evalAfter: evals[i + 1], // Hamle yapıldıktan sonraki tahta değerlendirmesi (Beyaz'a göre)
              bestCp,                  // Doğruluk hesabı için: en iyi hamlenin puanı (hamleyi yapana göre)
              playedCp,                // Doğruluk hesabı için: oynanan hamlenin puanı (hamleyi yapana göre)
              source: res ? res.source : null
            });
        }

        // PGN'de [Opening] başlığı yoksa açılış adını veritabanından bul
        // (oyundaki en derin eşleşen pozisyonun adı).
        let detectedOpening = null;
        if (openingDb) {
            for (let i = fens.length - 1; i > 0 && !detectedOpening; i--) {
                detectedOpening = openingDb.names.get(positionKey(fens[i])) || null;
            }
        }

        state = { headers: parsed.headers, moves: parsed.moves, fens, evals, bestMoveSanAt, perMove, detectedOpening, rawPgn: raw };
        currentPly = fens.length - 1;

        showReview();
    } catch (err) {
        console.error("Analiz hatası:", err);
        showError('Analiz edilemedi: ' + err.message);
    } finally {
        analyzeBtn.disabled = false;
        statusRow.classList.remove('active');
    }
}
// =========================================================
// ARAYÜZ — inceleme ekranı
// =========================================================
const setupView = document.getElementById('setupView');
const evalBarEl = document.getElementById('evalBar');
const evalFillEl = document.getElementById('evalFill');
const evalLabelEl = document.getElementById('evalLabel');
const evalGraphEl = document.getElementById('evalGraph');
const playerTopEl = document.getElementById('playerTop');
const playerBottomEl = document.getElementById('playerBottom');
const firstBtn = document.getElementById('firstBtn');
const lastBtn = document.getElementById('lastBtn');
const flipBtn = document.getElementById('flipBtn');
const gameTitleEl = document.getElementById('gameTitle');
const gameSubEl = document.getElementById('gameSub');
const commLabel = document.getElementById('commLabel');
const commEval = document.getElementById('commEval');
const commBest = document.getElementById('commBest');
const SVG_NS = 'http://www.w3.org/2000/svg';

// Hamle sınıfı rozeti (efsane, yorum kartı, tablo ve tahtada aynı görünüm)
function fillBadge(el, cls) {
  const meta = CLASS_META[cls] || CLASS_META.unknown;
  el.style.setProperty('--cls', meta.color);
  if (meta.symbolHtml) el.innerHTML = meta.symbolHtml;
  else el.textContent = meta.symbol;
  el.title = meta.label;
  return el;
}
function makeBadge(cls, extraClass = '') {
  const el = document.createElement('span');
  el.className = 'cls-badge ' + extraClass;
  return fillBadge(el, cls);
}

// Giriş ekranındaki "Hamleler nasıl işaretlenir?" listesi
function renderLegend() {
  const list = document.getElementById('legendList');
  if (!list) return;
  list.innerHTML = '';
  for (const cls of CLASS_ORDER) {
    const li = document.createElement('li');
    li.appendChild(makeBadge(cls));
    const b = document.createElement('b');
    b.textContent = CLASS_META[cls].label;
    li.appendChild(b);
    li.title = CLASS_META[cls].desc;
    list.appendChild(li);
  }
}
renderLegend();

// Giriş ekranının sağındaki örnek pozisyon: Opera Partisi, 13.Rxd7!!
function renderPreviewBoard() {
  const el = document.getElementById('previewBoard');
  if (!el) return;
  const board = new Chess('3rkb1r/p2Rqppp/5n2/1B2p1B1/4P3/1Q6/PPP2PPP/2K4R b k - 0 13').board();
  el.innerHTML = '';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = String.fromCharCode(97 + c) + (8 - r);
      const div = document.createElement('div');
      div.className = 'sq ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
      if (sq === 'd1' || sq === 'd7') {
        div.classList.add(sq === 'd7' ? 'hl-to' : 'hl-from');
        div.style.setProperty('--hl-color', CLASS_META.genius.color);
      }
      const p = board[r][c];
      if (p) {
        const g = document.createElement('div');
        g.className = `piece-graphic ${p.type}-${p.color}`;
        div.appendChild(g);
      }
      if (sq === 'd7') div.appendChild(makeBadge('genius', 'board-badge'));
      el.appendChild(div);
    }
  }
}
renderPreviewBoard();
const previewBoardBtn = document.getElementById('previewBoardBtn');
if (previewBoardBtn) previewBoardBtn.addEventListener('click', () => {
  pgnInput.value = SAMPLE_PGN;
  tabTextBtn.click();
  runAnalysis();
});

function playerName(color) {
  const h = (state && state.headers) || {};
  const name = color === 'w' ? h.White : h.Black;
  return name && name !== '?' ? name : (color === 'w' ? 'Beyaz' : 'Siyah');
}
function playerElo(color) {
  const h = (state && state.headers) || {};
  const elo = color === 'w' ? h.WhiteElo : h.BlackElo;
  return elo && elo !== '?' ? elo : '';
}

// Üst bar: oyuncular, sonuç, açılış, turnuva
function renderGameInfo() {
  const h = state.headers || {};
  gameTitleEl.textContent = `${playerName('w')} – ${playerName('b')}`;
  if (h.Result && h.Result !== '*') {
    const chip = document.createElement('span');
    chip.className = 'result-chip';
    chip.textContent = h.Result;
    gameTitleEl.appendChild(chip);
  }
  const det = state.detectedOpening;
  const opening = h.Opening || (det && det.name) || '';
  const eco = h.ECO || (det && det.eco) || '';
  const parts = [];
  if (opening) parts.push(eco ? `${opening} (${eco})` : opening);
  if (h.Event && h.Event !== '?') parts.push(h.Event);
  if (h.Date && !h.Date.startsWith('?')) parts.push(h.Date.replace(/\.\?\?/g, ''));
  gameSubEl.textContent = parts.join(', ');
}

// Tahtanın üstündeki ve altındaki oyuncu şeritleri (tahta çevrilince yer değiştirir)
function renderPlayers() {
  const acc = state.accuracies || {};
  const fill = (el, color) => {
    el.innerHTML = '';
    const sw = document.createElement('span');
    sw.className = 'swatch ' + (color === 'w' ? 'swatch-w' : 'swatch-b');
    const name = document.createElement('span');
    name.className = 'player-name';
    const elo = playerElo(color);
    name.textContent = playerName(color) + (elo ? ` (${elo})` : '');
    const a = document.createElement('span');
    a.className = 'player-acc';
    const v = color === 'w' ? acc.white : acc.black;
    a.textContent = v !== null && v !== undefined ? `%${v.toFixed(1)}` : '';
    a.title = 'Doğruluk';
    el.append(sw, name, a);
  };
  fill(playerTopEl, boardFlipped ? 'w' : 'b');
  fill(playerBottomEl, boardFlipped ? 'b' : 'w');
}

// Doğruluk + hangi sınıftan kaç hamle
// Özet tablosu: oyuncu başına doğruluk ve her sınıftan kaç hamle (sütun başlıkları sınıf simgeleri)
function renderAccuracy() {
  const acc = state.accuracies;
  whiteAccEl.textContent = acc.white !== null ? '%' + acc.white.toFixed(1) : '—';
  blackAccEl.textContent = acc.black !== null ? '%' + acc.black.toFixed(1) : '—';
  document.getElementById('accWhiteName').textContent = playerName('w');
  document.getElementById('accBlackName').textContent = playerName('b');

  const head = document.getElementById('summaryHead');
  head.querySelectorAll('.sum-cls-h').forEach(el => el.remove());
  for (const cls of CLASS_ORDER) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.className = 'sum-cls-h';
    th.appendChild(makeBadge(cls));
    head.appendChild(th);
  }
  const counts = { w: {}, b: {} };
  for (const m of state.perMove) counts[m.color][m.cls] = (counts[m.color][m.cls] || 0) + 1;
  for (const [rowId, c] of [['sumRowW', 'w'], ['sumRowB', 'b']]) {
    const row = document.getElementById(rowId);
    row.querySelectorAll('.sum-count').forEach(el => el.remove());
    for (const cls of CLASS_ORDER) {
      const td = document.createElement('td');
      const n = counts[c][cls] || 0;
      td.className = 'sum-count' + (n > 0 ? ' has' : '');
      td.textContent = n;
      td.title = `${playerName(c)}: ${n} × ${CLASS_META[cls].label.toLowerCase()}`;
      if (n > 0) td.style.setProperty('--cls', CLASS_META[cls].color);
      row.appendChild(td);
    }
  }
}

function renderMoveList() {
  moveListEl.innerHTML = '';
  const total = state.perMove.length;
  for (let k = 0; k < Math.ceil(total / 2); k++) {
    const row = document.createElement('div');
    row.className = 'move-row';
    const num = document.createElement('span');
    num.className = 'move-num';
    num.textContent = (k + 1) + '.';
    row.appendChild(num);
    for (const idx of [k * 2, k * 2 + 1]) {
      const mv = state.perMove[idx];
      const chip = document.createElement('button');
      chip.className = 'move-chip' + (mv ? ' cls-' + mv.cls : ' empty');
      if (mv) {
        const meta = CLASS_META[mv.cls] || CLASS_META.unknown;
        chip.style.setProperty('--cls', meta.color);
        chip.dataset.ply = String(idx + 1);
        chip.title = meta.label;
        const san = document.createElement('span');
        san.className = 'mv-san';
        san.textContent = mv.san;
        chip.appendChild(san);
        // Liste kalabalık olmasın diye "en iyi" ve "iyi" hamlelerde simge gösterilmez
        if (!['optimum', 'optimum2'].includes(mv.cls)) {
          const sym = document.createElement('span');
          sym.className = 'mv-sym';
          if (meta.symbolHtml) sym.innerHTML = meta.symbolHtml; else sym.textContent = meta.symbol;
          chip.appendChild(sym);
        }
        chip.addEventListener('click', () => goToPly(idx + 1));
      } else {
        chip.tabIndex = -1;
      }
      row.appendChild(chip);
    }
    moveListEl.appendChild(row);
  }
}

let state = null;
let currentPly = 0;
let boardFlipped = false;
let perspectiveColor = 'auto';
function updatePerspectiveFromSelect() {
  perspectiveColor = colorSelect.value;
  boardFlipped = perspectiveColor === 'black';
}
colorSelect.addEventListener('change', updatePerspectiveFromSelect);
updatePerspectiveFromSelect();

function showReview() {
  state.accuracies = computeAccuracies();
  setupView.classList.add('is-hidden');
  reviewLayout.classList.add('active');
  renderGameInfo();
  renderMoveList();
  renderAccuracy();
  renderPlayers();
  goToPly(currentPly);
  syncAnalysisHeight();
  window.scrollTo(0, 0);
}

// Sağ panelin yüksekliğini artık CSS yönetiyor (ekran yüksekliğini doldurur); eski satır içi
// yükseklik kalmışsa temizle.
function syncAnalysisHeight() {
  const sideColEl = document.querySelector('.side-col.analysis-col');
  if (sideColEl) sideColEl.style.height = '';
}
window.addEventListener('resize', () => { syncAnalysisHeight(); if (state) renderEvalGraph(); });
if (window.ResizeObserver) {
  const ro = new ResizeObserver(() => { syncAnalysisHeight(); if (state) renderEvalGraph(); });
  ro.observe(document.querySelector('.board-col'));
  ro.observe(evalGraphEl);
}

function renderBoard(fen, move) {
  const board = new Chess(fen).board();
  const meta = move ? (CLASS_META[move.cls] || CLASS_META.unknown) : null;
  boardEl.innerHTML = '';
  for (let visRow = 0; visRow < 8; visRow++) {
    for (let visCol = 0; visCol < 8; visCol++) {
      const row = boardFlipped ? 7 - visRow : visRow;
      const col = boardFlipped ? 7 - visCol : visCol;
      const cellPiece = board[row][col];
      const sqName = String.fromCharCode(97 + col) + (8 - row);
      const div = document.createElement('div');
      div.className = 'sq ' + ((row + col) % 2 === 0 ? 'light' : 'dark');
      if (move && (sqName === move.from || sqName === move.to)) {
        div.classList.add(sqName === move.to ? 'hl-to' : 'hl-from');
        div.style.setProperty('--hl-color', meta.color);
      }
      if (cellPiece) {
        const graphic = document.createElement('div');
        graphic.className = `piece-graphic ${cellPiece.type}-${cellPiece.color}`;
        div.appendChild(graphic);
      }
      if (move && sqName === move.to) div.appendChild(makeBadge(move.cls, 'board-badge'));
      boardEl.appendChild(div);
    }
  }
  renderCoordLabels();
}

function renderCoordLabels() {
  const files = [], ranks = [];
  for (let v = 0; v < 8; v++) {
    files.push(String.fromCharCode(97 + (boardFlipped ? 7 - v : v)));
    ranks.push(8 - (boardFlipped ? 7 - v : v));
  }
  const buildSpans = arr => arr.map(v => `<span>${v}</span>`).join('');
  coordsTop.innerHTML = coordsBottom.innerHTML = buildSpans(files);
  coordsLeft.innerHTML = coordsRight.innerHTML = buildSpans(ranks);
}

function fileIndex(sq) { return sq.charCodeAt(0) - 97; }
function rankIndexFromTop(sq) { return 8 - parseInt(sq[1], 10); }
function squareToXY(sqName) {
  const cell = 60;
  let col = fileIndex(sqName), row = rankIndexFromTop(sqName);
  if (boardFlipped) { col = 7 - col; row = 7 - row; }
  return { x: col * cell + cell / 2, y: row * cell + cell / 2 };
}

// Motorun önerdiği hamle oku. Ok başı elle çizilir: eskiden SVG marker çizgi kalınlığıyla
// büyüdüğü için ok hedef karenin bir kare ötesine taşıyordu.
function drawArrow(fromSq, toSq, color) {
  arrowOverlay.innerHTML = '';
  if (!fromSq || !toSq) return;
  const p1 = squareToXY(fromSq), p2 = squareToXY(toSq);
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const head = 20, half = 13, tipInset = 6;
  const tipX = p2.x - ux * tipInset, tipY = p2.y - uy * tipInset;
  const baseX = tipX - ux * head, baseY = tipY - uy * head;
  const startX = p1.x + ux * 8, startY = p1.y + uy * 8;
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('opacity', '0.85');
  const line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('x1', startX); line.setAttribute('y1', startY);
  line.setAttribute('x2', baseX); line.setAttribute('y2', baseY);
  line.setAttribute('stroke', color); line.setAttribute('stroke-width', '10');
  line.setAttribute('stroke-linecap', 'round');
  const poly = document.createElementNS(SVG_NS, 'polygon');
  poly.setAttribute('points', [
    `${tipX},${tipY}`,
    `${baseX - uy * half},${baseY + ux * half}`,
    `${baseX + uy * half},${baseY - ux * half}`
  ].join(' '));
  poly.setAttribute('fill', color);
  g.append(line, poly);
  arrowOverlay.appendChild(g);
}

// Bir ply için Beyaz'ın bakış açısından değerlendirme (eksikse en yakın önceki değer)
function evalAtPly(ply) {
  for (let i = ply; i >= 0; i--) if (state.evals[i] !== null && state.evals[i] !== undefined) return state.evals[i];
  return 0;
}
// Beyaz'ın kazanma yüzdesi (0–100); mat görünüyorsa tam dolu
function whiteWinPercent(cp) {
  if (cp >= 8000) return 100;
  if (cp <= -8000) return 0;
  return cpToWinPercent(cp);
}
function formatScoreShort(cp) {
  if (Math.abs(cp) >= 8000) return 'M';
  if (Math.abs(cp) >= TB_WIN_CP) return 'TB';
  return (Math.abs(cp) / 100).toFixed(1);
}

function renderEvalBar(cp) {
  const pct = whiteWinPercent(cp);
  evalBarEl.classList.toggle('flipped', boardFlipped);
  evalFillEl.style.height = pct.toFixed(1) + '%';
  evalLabelEl.textContent = formatScoreShort(cp);
  evalLabelEl.className = 'eval-label ' + (cp >= 0 ? 'on-white' : 'on-black');
  evalBarEl.setAttribute('aria-label', 'Değerlendirme: ' + formatScore(cp));
}

// Avantaj grafiği: alttan dolan açık renk alan Beyaz'ın kazanma şansı.
// Hatalı ve ciddi hata hamleleri noktayla işaretlenir; tıklanınca o hamleye gidilir.
function renderEvalGraph() {
  if (!state || !evalGraphEl) return;
  const W = Math.max(200, Math.round(evalGraphEl.clientWidth || 600));
  const H = Math.max(40, Math.round(evalGraphEl.clientHeight || 64)), pad = 5;
  const n = state.fens.length;
  const x = i => (n > 1 ? (i / (n - 1)) * W : 0);
  const y = i => pad + (1 - whiteWinPercent(evalAtPly(i)) / 100) * (H - 2 * pad);
  evalGraphEl.setAttribute('viewBox', `0 0 ${W} ${H}`);
  evalGraphEl.setAttribute('preserveAspectRatio', 'none'); // kenarlarda boşluk kalmasın
  let d = `M0,${H} `;
  for (let i = 0; i < n; i++) d += `L${x(i).toFixed(1)},${y(i).toFixed(1)} `;
  d += `L${W},${H} Z`;
  const dots = state.perMove.map((m, i) => (m.cls === 'fatal' || m.cls === 'flaw' || m.cls === 'genius')
    ? `<circle class="g-dot" cx="${x(i + 1).toFixed(1)}" cy="${y(i + 1).toFixed(1)}" r="4" fill="${CLASS_META[m.cls].color}"><title>${Math.ceil((i + 1) / 2)}${m.color === 'w' ? '.' : '...'} ${m.san}: ${CLASS_META[m.cls].label}</title></circle>`
    : '').join('');
  evalGraphEl.innerHTML =
    `<rect class="g-black" x="0" y="0" width="${W}" height="${H}"/>` +
    `<path class="g-white" d="${d}"/>` +
    `<line class="g-mid" x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}"/>` +
    `<line class="g-cursor" x1="${x(currentPly)}" y1="0" x2="${x(currentPly)}" y2="${H}"/>` +
    dots;
}
evalGraphEl.addEventListener('click', (e) => {
  if (!state) return;
  const rect = evalGraphEl.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  goToPly(Math.round(ratio * (state.fens.length - 1)));
});

function moveNumberLabel(ply, color) {
  const n = Math.ceil(ply / 2);
  return color === 'w' ? `${n}.` : `${n}...`;
}

function updateCommentary(move, ply) {
  const prevFen = ply > 0 ? state.fens[ply - 1] : null;
  commPvContainer.classList.add('hidden');
  commBest.textContent = '';
  if (!move) {
    commentaryCard.style.removeProperty('--cls');
    commBadge.textContent = '';
    commLabel.textContent = 'Başlangıç konumu';
    commEval.textContent = formatScore(evalAtPly(0));
    commTitle.textContent = '';
    commText.textContent = 'Hamleler arasında ← → tuşlarıyla, listeden ya da aşağıdaki grafiğe tıklayarak gezinebilirsin.';
    return;
  }
  const meta = CLASS_META[move.cls] || CLASS_META.unknown;
  commentaryCard.style.setProperty('--cls', meta.color);
  fillBadge(commBadge, move.cls);
  commLabel.textContent = meta.label;
  commEval.textContent = move.evalBefore !== null && move.evalAfter !== null
    ? `${formatScore(move.evalBefore)} → ${formatScore(move.evalAfter)}`
    : '';
  commTitle.textContent = `${moveNumberLabel(ply, move.color)} ${move.san}`;
  commText.textContent = meta.desc;
  const isGood = ['optimum', 'genius', 'sharp', 'book'].includes(move.cls);
  if (!isGood && move.bestSan && move.bestSan !== move.san) {
    commBest.append('Daha iyisi: ');
    const b = document.createElement('b');
    b.textContent = move.bestSan;
    commBest.appendChild(b);
  }
  if (!isGood && move.pv && prevFen) {
    const pv = formatPv(prevFen, move.pv);
    if (pv) {
      commPvText.textContent = pv;
      commPvContainer.title = pv; // tek satıra sığmazsa tamamı fareyle üzerine gelince görünür
      commPvContainer.classList.remove('hidden');
    }
  }
}

function goToPly(ply) {
  if (!state) return;
  currentPly = Math.max(0, Math.min(state.fens.length - 1, ply));
  const fen = state.fens[currentPly];
  const move = currentPly > 0 ? state.perMove[currentPly - 1] : null;
  renderBoard(fen, move);
  updateCommentary(move, currentPly);
  renderEvalBar(evalAtPly(currentPly));
  renderEvalGraph();

  arrowOverlay.innerHTML = '';
  if (!move) {
    plyLabel.textContent = 'Başlangıç konumu';
  } else {
    plyLabel.textContent = `${moveNumberLabel(currentPly, move.color)} ${move.san}`;
    const isGood = ['optimum', 'genius', 'sharp', 'book'].includes(move.cls);
    if (!isGood && move.bestSan && move.bestSan !== move.san) {
      const best = new Chess(state.fens[currentPly - 1]).moves({ verbose: true }).find(mv => mv.san === move.bestSan);
      if (best) drawArrow(best.from, best.to, CLASS_META.optimum.color);
    }
  }
  firstBtn.disabled = prevBtn.disabled = currentPly === 0;
  lastBtn.disabled = nextBtn.disabled = currentPly === state.fens.length - 1;

  const prevActive = moveListEl.querySelector('.move-chip.active');
  if (prevActive) prevActive.classList.remove('active');
  const activeChip = moveListEl.querySelector(`.move-chip[data-ply="${currentPly}"]`);
  if (activeChip) {
    activeChip.classList.add('active');
    // Sadece listenin içini kaydır (sayfanın kendisini kaydırmadan)
    const top = activeChip.offsetTop - moveListEl.offsetTop;
    if (top < moveListEl.scrollTop) moveListEl.scrollTop = top - 8;
    else if (top + activeChip.offsetHeight > moveListEl.scrollTop + moveListEl.clientHeight) {
      moveListEl.scrollTop = top + activeChip.offsetHeight - moveListEl.clientHeight + 8;
    }
  } else if (currentPly === 0) {
    moveListEl.scrollTop = 0;
  }
}

function flipBoard() {
  boardFlipped = !boardFlipped;
  renderPlayers();
  goToPly(currentPly);
}

firstBtn.addEventListener('click', () => goToPly(0));
prevBtn.addEventListener('click', () => goToPly(currentPly - 1));
nextBtn.addEventListener('click', () => goToPly(currentPly + 1));
lastBtn.addEventListener('click', () => goToPly(state.fens.length - 1));
flipBtn.addEventListener('click', flipBoard);
document.addEventListener('keydown', (e) => {
  if (!state) return;
  if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  if (e.key === 'ArrowLeft') { goToPly(currentPly - 1); e.preventDefault(); }
  else if (e.key === 'ArrowRight') { goToPly(currentPly + 1); e.preventDefault(); }
  else if (e.key === 'Home') { goToPly(0); e.preventDefault(); }
  else if (e.key === 'End') { goToPly(state.fens.length - 1); e.preventDefault(); }
  else if (e.key === 'f' || e.key === 'F') flipBoard();
});
analyzeBtn.addEventListener('click', runAnalysis);

// İncelenen partiyi .pgn dosyası olarak indir
document.getElementById('downloadPgnBtn').addEventListener('click', () => {
  if (!state) return;
  const safe = t => String(t).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'oyuncu';
  const name = `${safe(playerName('w'))}_${safe(playerName('b'))}.pgn`;
  const blob = new Blob([state.rawPgn.trim() + '\n'], { type: 'application/x-chess-pgn' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

document.getElementById('backToSetupBtn').addEventListener('click', () => {
  reviewLayout.classList.remove('active');
  setupView.classList.remove('is-hidden');
  state = null;
  currentPly = 0;
  pgnInput.value = '';
  resetFileSelection();
  analyzeBtn.disabled = false;
  progressFill.style.width = '0%';
  updatePerspectiveFromSelect();
  window.scrollTo(0, 0);
});

// --- Yardımcı Fonksiyonlar ---
function getPieceCount(fen) {
  const position = fen.split(' ')[0];
  return position.replace(/[^a-zA-Z]/g, "").length;
}

// [DÜZELTME #2] Lichess tablebase "category" alanı → santipiyon (sırası gelen tarafa göre).
// cursed-win / blessed-loss: 50 hamle kuralı yüzünden pratikte beraberlik.
const TB_CATEGORY_CP = {
  'win': TB_WIN_CP, 'syzygy-win': TB_WIN_CP, 'maybe-win': TB_WIN_CP,
  'loss': -TB_WIN_CP, 'syzygy-loss': -TB_WIN_CP, 'maybe-loss': -TB_WIN_CP,
  'draw': 0, 'cursed-win': 0, 'blessed-loss': 0
};

// Lichess bazı yerlerde rok hamlesini "şah kaleyi alır" biçiminde yazar (e1h1).
// Oyundaki hamlelerle karşılaştırabilmek için standart UCI'ye (e1g1) çevrilir.
function normalizeCastlingUci(fen, uci) {
  if (!uci) return uci;
  const map = { e1h1: 'e1g1', e1a1: 'e1c1', e8h8: 'e8g8', e8a8: 'e8c8' };
  if (!map[uci]) return uci;
  const piece = new Chess(fen).get(uci.slice(0, 2));
  return piece && piece.type === 'k' ? map[uci] : uci;
}

// Tüm kaynaklar aynı biçimde sonuç döndürür; TÜM puanlar SIRASI GELEN TARAFIN bakış açısındadır:
// { source, score, score2, bestMoveUci, pv, moveScores: { uci: score } }
async function getHybridAnalysis(fen) {
  const pieceCount = getPieceCount(fen);
  const sideToMoveIsWhite = fen.split(' ')[1] === 'w';

  // 0. Oyun bitmiş mi? (mat / pat / yetersiz materyal)
  // Bu pozisyonlarda bulut kaynakları sonuç vermiyor, tarayıcıdaki Stockfish.js de hamle
  // döndürmediği için analiz zaman aşımına kadar (~70 sn) takılıyordu. Ayrıca son hamle
  // (ör. Rd8#) ekranda "(0.00)" görünüyordu. Sonucu doğrudan kendimiz veriyoruz.
  const g = new Chess(fen);
  if (g.in_checkmate()) {
    return { source: 'game_over', score: { type: 'mate', value: 0 }, score2: null, bestMoveUci: null, pv: '', moveScores: {} };
  }
  if (g.in_stalemate() || g.insufficient_material()) {
    return { source: 'game_over', score: { type: 'cp', value: 0 }, score2: null, bestMoveUci: null, pv: '', moveScores: {} };
  }

  // 1. Oyun Sonu (7 veya daha az taş): Lichess Syzygy tablebase — kesin sonuç
  if (pieceCount <= 7) {
    try {
      const syzygyResp = await fetch(`https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(fen)}`);
      if (syzygyResp.ok) {
        const data = await syzygyResp.json();
        // [DÜZELTME #2] Eskiden: score = checkmate ? +10000 : dtm.
        //  - dtm "mata kalan yarım hamle sayısı"dır, santipiyon değil (15 → +0.15 okunuyordu).
        //  - checkmate=true, sırası gelen tarafın MAT OLDUĞU anlamına gelir; puan -mat olmalı.
        let score = null;
        if (data.checkmate) score = { type: 'mate', value: 0 };            // mat olmuş taraf
        else if (data.stalemate || data.insufficient_material) score = { type: 'cp', value: 0 };
        else if (data.category in TB_CATEGORY_CP) score = { type: 'cp', value: TB_CATEGORY_CP[data.category] };

        if (score) {
          // Tablebase'deki hamle kategorileri RAKİBİN bakış açısındadır ("loss" = rakip kaybeder,
          // yani bizim için kazanç), bu yüzden işaret çevrilir.
          const moveScores = {};
          const scored = [];
          for (const m of (data.moves || [])) {
            let ms = null;
            if (m.checkmate) ms = { type: 'mate', value: 1 };              // bu hamle mat ediyor
            else if (m.stalemate || m.insufficient_material) ms = { type: 'cp', value: 0 };
            else if (m.category in TB_CATEGORY_CP) ms = { type: 'cp', value: -TB_CATEGORY_CP[m.category] };
            if (ms) { moveScores[m.uci] = ms; scored.push(ms); }
          }
          return {
            source: 'syzygy_tablebase',
            score,
            score2: scored.length > 1 ? scored[1] : null, // hamleler en iyiden kötüye sıralı gelir
            bestMoveUci: data.moves && data.moves.length > 0 ? data.moves[0].uci : null,
            pv: '',
            moveScores
          };
        }
      }
    } catch (e) {
      console.warn("Tablebase API hatası:", e);
    }
  }

  // 2. ChessDB (yüksek derinlikli bulut arşivi). Puanlar sırası gelen tarafa göredir.
  try {
    const chessDbResp = await fetch(`https://www.chessdb.cn/cdb.php?action=queryall&board=${encodeURIComponent(fen)}&json=1`);
    if (chessDbResp.ok) {
      const data = await chessDbResp.json();
      if (data.status === 'ok' && data.moves && data.moves.length > 0) {
        // [DÜZELTME] JSON modunda hamle alanının adı "uci"dir; eski kod "move" okuduğu için
        // ChessDB'den gelen en iyi hamle hep undefined oluyordu (ok çizilmiyordu).
        const moveScores = {};
        for (const m of data.moves) moveScores[m.uci] = { type: 'cp', value: m.score };
        return {
          source: 'chessdb_cloud',
          score: { type: 'cp', value: data.moves[0].score },
          // [DÜZELTME #3] ChessDB tüm hamleleri döndürüyor; ikinci en iyi hamle buradan alınır.
          score2: data.moves.length > 1 ? { type: 'cp', value: data.moves[1].score } : null,
          bestMoveUci: data.moves[0].uci,
          pv: '',
          moveScores
        };
      }
    }
  } catch (e) {
    console.warn("ChessDB API hatası:", e);
  }

  // 3. Lichess Cloud Eval
  try {
    // [DÜZELTME #3] multiPv=3: ikinci en iyi hamlenin puanı (score2) için birden fazla varyant iste.
    const lichessCloudResp = await fetch(`https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=3`);
    if (lichessCloudResp.ok) {
      const data = await lichessCloudResp.json();
      if (data.pvs && data.pvs.length > 0) {
        // [DÜZELTME #1] Lichess puanları HER ZAMAN BEYAZ'IN bakış açısındadır. Uygulamanın geri
        // kalanı ise puanın sırası gelen tarafa göre olduğunu varsayar (normalizeScore Siyah için
        // işareti çevirir). Eskiden Siyah'ın sırası olan pozisyonlarda puan iki kez çevrilip
        // TERS çıkıyordu. Burada Siyah'ın sırasıysa işareti bir kez çevirerek düzeltiyoruz.
        const sign = sideToMoveIsWhite ? 1 : -1;
        const toScore = pv => (pv.mate !== undefined && pv.mate !== null)
          ? { type: 'mate', value: sign * pv.mate }
          : { type: 'cp', value: sign * (pv.cp || 0) };
        const moveScores = {};
        for (const pv of data.pvs) {
          const first = normalizeCastlingUci(fen, pv.moves.split(' ')[0]);
          moveScores[first] = toScore(pv);
        }
        return {
          source: 'lichess_cloud',
          score: toScore(data.pvs[0]),
          score2: data.pvs.length > 1 ? toScore(data.pvs[1]) : null,
          bestMoveUci: normalizeCastlingUci(fen, data.pvs[0].moves.split(' ')[0]),
          pv: data.pvs[0].moves,
          moveScores
        };
      }
    }
  } catch (e) {
    console.warn("Lichess Cloud API hatası:", e);
  }

  return null; 
}

function formatScore(cp) {
  if (cp === null || cp === undefined) return '0.00';
  if (Math.abs(cp) >= 8000) {
    return cp > 0 ? 'Mat' : '-Mat';
  }
  // Tablebase'in kesin kazanç/kayıp sonucu (bkz. TB_WIN_CP)
  if (Math.abs(cp) >= TB_WIN_CP) {
    return cp > 0 ? 'Kazanç (TB)' : 'Kayıp (TB)';
  }
  const val = (cp / 100).toFixed(2);
  return cp > 0 ? `+${val}` : `${val}`;
}

function formatPv(startFen, pvString) {
  if (!pvString) return '';
  const tempGame = new Chess(startFen);
  // En fazla 10 yarım hamle göster; UCI dışı parçaları (ör. "bmc") at
  const moves = pvString.split(/\s+/).filter(m => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m) || /^[KQRBNO]?[a-h1-8x=+#-]+$/.test(m)).slice(0, 10);
  const formatted = [];
  
  let moveNum = parseInt(startFen.split(' ')[5], 10) || 1;
  let activeColor = startFen.split(' ')[1]; 
  
  for (let i = 0; i < moves.length; i++) {
    const rawMove = moves[i];
    if (!rawMove) continue;
    
    let sanMove = rawMove;
    if (rawMove.length >= 4) {
      const from = rawMove.slice(0, 2);
      const to = rawMove.slice(2, 4);
      const promo = rawMove.length > 4 ? rawMove.slice(4, 5) : undefined;
      const matched = tempGame.moves({ verbose: true }).find(mv => mv.from === from && mv.to === to && (!promo || mv.promotion === promo));
      if (matched) {
        sanMove = matched.san;
        tempGame.move(matched.san);
      } else {
        try {
          tempGame.move(rawMove);
          sanMove = rawMove;
        } catch(e) { break; }
      }
    } else {
      try {
        tempGame.move(rawMove);
      } catch(e) { break; }
    }

    if (activeColor === 'w') {
      formatted.push(`${moveNum}.${sanMove}`);
      activeColor = 'b';
    } else {
      if (i === 0) {
        formatted.push(`${moveNum}...${sanMove}`);
      } else {
        formatted.push(sanMove);
      }
      moveNum++;
      activeColor = 'w';
    }
  }
  return formatted.join(' ');
}
