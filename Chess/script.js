import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@0.13.4/chess.js';
const CLASS_VAR = { 
  genius: '--genius', 
  sharp: '--sharp', 
  optimum: '--optimum', 
  optimum2: '--optimum2', 
  flaw: '--flaw', 
  fatal: '--fatal',
  book: '--book', // Açılış hamlesi sınıfı eklendi
  unknown: '--text-secondary' // Analiz verisi alınamayan pozisyonlar için
};
const FALLBACK_DEPTH = 13;
const pgnInput = document.getElementById('pgnInput');
const commentaryCard = document.getElementById('commentaryCard');
const commBadge = document.getElementById('commBadge');
const commTitle = document.getElementById('commTitle');
const commText = document.getElementById('commText');
const commPvContainer = document.getElementById('commPvContainer');
const commPvText = document.getElementById('commPvText');
const tabFileBtn = document.getElementById('tabFileBtn');

  const tabTextBtn = document.getElementById('tabTextBtn');
  const contentFile = document.getElementById('contentFile');
  const contentText = document.getElementById('contentText');
  const dropzoneLabel = document.getElementById('dropzoneLabel');
  const fileStatusText = document.getElementById('fileStatusText');
  const pgnFileInput = document.getElementById('pgnFile');
  tabFileBtn.addEventListener('click', () => {
    tabFileBtn.classList.add('active');
    tabTextBtn.classList.remove('active');
    contentFile.classList.add('active');
    contentText.classList.remove('active');
  });
  tabTextBtn.addEventListener('click', () => {
    tabTextBtn.classList.add('active');
    tabFileBtn.classList.remove('active');
    contentText.classList.add('active');
    contentFile.classList.remove('active');
  });

  // --- Sadece .pgn dosyalarına izin veren doğrulama mantığı ---
  function isPgnFile(file) {
    return !!file && /\.pgn$/i.test(file.name);
  }
  function resetFileSelection() {
    pgnFileInput.value = '';
    fileStatusText.textContent = '';
  }
  function goToFileSelectScreen() {
    tabFileBtn.click();
    dropzoneLabel.classList.remove('dragover');
  }
  function handleIncomingFile(file) {
    if (!file) return;
    if (!isPgnFile(file)) {
      showError(`Geçersiz dosya türü: "${file.name}". Lütfen sadece .pgn uzantılı bir dosya yükleyin.`);
      resetFileSelection();
      goToFileSelectScreen();
      return;
    }
    clearError();
    const reader = new FileReader();
    reader.onload = () => {
      pgnInput.value = reader.result;
      fileStatusText.textContent = `✓ ${file.name} yüklendi.`;
    };
    reader.onerror = () => {
      showError(`"${file.name}" dosyası okunamadı. Lütfen tekrar deneyin.`);
      resetFileSelection();
      goToFileSelectScreen();
    };
    reader.readAsText(file);
  }

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzoneLabel.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzoneLabel.classList.add('dragover');
    }, false);
  });
  ['dragleave', 'drop'].forEach(eventName => {
    dropzoneLabel.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzoneLabel.classList.remove('dragover');
    }, false);
  });
  dropzoneLabel.addEventListener('drop', (e) => {
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    handleIncomingFile(file);
  }, false);
  pgnFileInput.addEventListener('change', () => {
    handleIncomingFile(pgnFileInput.files[0]);
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

sampleBtn.addEventListener('click', () => { 
  pgnInput.value = SAMPLE_PGN; 
  document.getElementById('tabTextBtn').click();
});

function showError(msg) { errorMsg.textContent = msg; errorMsg.classList.add('active'); }
function clearError() { errorMsg.classList.remove('active'); errorMsg.textContent = ''; }
function sanitizePgn(raw) {
  let s = raw;
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
              firstMoves[idx] = pvMatch[1].split(' ')[0];
              if (idx === 1) currentPv = pvMatch[1];
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
function moveAccuracy(winBefore, winAfter) {
  const diff = Math.max(0, winBefore - winAfter);
  // Katsayı -0.068 yapılarak hataların doğruluğu düşürme etkisi sertleştirildi
  const acc = 103.1668 * Math.exp(-0.068 * diff) - 3.1669; 
  return Math.max(0, Math.min(100, acc));
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


function computeAccuracies() {
  const wAccs = [], bAccs = [];
  for (let i = 0; i < state.moves.length; i++) {
    // AÇILIŞ KORUMASI: Kitap hamlelerini (book) ve analiz verisi alınamayan
    // (unknown) hamleleri doğruluk ortalamasını yapay şekilde etkilememesi için hesaba katmıyoruz
    if (state.perMove[i] && (state.perMove[i].cls === 'book' || state.perMove[i].cls === 'unknown')) {
      continue; 
    }
    
    const moverIsWhite = state.moves[i].color === 'w';
    // [DÜZELTME #4] Doğruluk, sınıflandırmayla aynı (tek kaynaktan gelen) puanlardan hesaplanır:
    // bestCp = pozisyondaki en iyi hamlenin puanı, playedCp = oynanan hamlenin puanı.
    const winBefore = cpToWinPercent(state.perMove[i].bestCp);
    const winAfter = cpToWinPercent(state.perMove[i].playedCp);
    const acc = moveAccuracy(winBefore, winAfter);
    if (moverIsWhite) wAccs.push(acc); else bAccs.push(acc);
  }
  const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  return { white: avg(wAccs), black: avg(bAccs) };
}

function renderMoveList() {
  moveListEl.innerHTML = '';
  const total = state.perMove.length;
  const fullMoves = Math.ceil(total / 2);
  for (let k = 0; k < fullMoves; k++) {
    const whiteIdx = k * 2;
    const blackIdx = k * 2 + 1;
    const row = document.createElement('div');
    row.className = 'move-row';
    
    const num = document.createElement('span');
    num.className = 'move-num';
    num.textContent = (k + 1) + '.';
    row.appendChild(num);
    
    // BEYAZ HAMLE CHIP
    const wMove = state.perMove[whiteIdx];
    const wChip = document.createElement('button');
    // Renklendirme sınıflarını (mv-optimum vb.) kaldırıp sadece temiz bir buton oluşturuyoruz
    wChip.className = 'move-chip' + (wMove ? '' : ' empty');
    if (wMove) {
      wChip.textContent = wMove.san;
      wChip.dataset.ply = String(whiteIdx + 1);
      wChip.addEventListener('click', () => goToPly(whiteIdx + 1));
    }
    row.appendChild(wChip);
    
    // SİYAH HAMLE CHIP
    const bMove = state.perMove[blackIdx];
    const bChip = document.createElement('button');
    bChip.className = 'move-chip' + (bMove ? '' : ' empty');
    if (bMove) {
      bChip.textContent = bMove.san;
      bChip.dataset.ply = String(blackIdx + 1);
      bChip.addEventListener('click', () => goToPly(blackIdx + 1));
    }
    row.appendChild(bChip);
    
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
colorSelect.addEventListener('change', () => {
  updatePerspectiveFromSelect();
  if (state) { goToPly(currentPly); }
});
updatePerspectiveFromSelect();




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
                statusLine.textContent = `Analiz devam ediyor: ${completedCount}/${fens.length} pozisyon.`;
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

        state = { headers: parsed.headers, moves: parsed.moves, fens, evals, bestMoveSanAt, perMove, detectedOpening };
        currentPly = fens.length - 1;

        renderMoveList();
        
        // Arayüz geçişleri
        document.getElementById('mainHeader').style.display = 'none';
        mainSetupPanel.style.display = 'none';
        document.getElementById('mainFooter').style.display = 'none';
        reviewLayout.classList.add('active');
        
        // Dinamik Açılış İsmi Kartını Göster
        const openingCard = document.getElementById('openingCard');
        const openingNameText = document.getElementById('openingNameText');
        const hdr = state.headers || {};
        const detected = state.detectedOpening;
        if (openingCard && openingNameText && (hdr.Opening || hdr.ECO || detected)) {
          const name = hdr.Opening || (detected && detected.name) || "Bilinmeyen Açılış Teorisi";
          const ecoCode = hdr.ECO || (detected && detected.eco);
          const eco = ecoCode ? ` [${ecoCode}]` : "";
          openingNameText.textContent = name + eco;
          openingCard.style.display = 'block';
        } else if (openingCard) {
          openingCard.style.display = 'none';
        }

        // Doğruluk Oranlarını Kartlara Yazdır
        const accuracies = computeAccuracies();
        if (accuracies.white !== null && accuracies.black !== null) {
          whiteAccEl.textContent = '%' + accuracies.white.toFixed(1);
          blackAccEl.textContent = '%' + accuracies.black.toFixed(1);
        } else {
          whiteAccEl.textContent = '—';
          blackAccEl.textContent = '—';
        }

       goToPly(currentPly);
        syncAnalysisHeight();
    } catch (err) {
        console.error("Analiz hatası:", err);
        showError('Analiz edilemedi: ' + err.message);
    } finally {
        analyzeBtn.disabled = false;
        statusRow.classList.remove('active');
    }
}
function syncAnalysisHeight() {
  const boardColEl = document.querySelector('.board-col');
  const sideColEl = document.querySelector('.side-col.analysis-col');
  if (!boardColEl || !sideColEl) return;
  if (window.matchMedia('(max-width: 1080px)').matches) {
    sideColEl.style.height = '';
    return;
  }
  sideColEl.style.height = boardColEl.offsetHeight + 'px';
}
window.addEventListener('resize', syncAnalysisHeight);
if (window.ResizeObserver) {
  const boardResizeObserver = new ResizeObserver(() => syncAnalysisHeight());
  window.addEventListener('DOMContentLoaded', () => {
    const boardColEl = document.querySelector('.board-col');
    if (boardColEl) boardResizeObserver.observe(boardColEl);
  });
}

function renderBoard(fen, highlightTo, evaluationCls) {
  const g = new Chess(fen);
  const board = g.board();
  boardEl.innerHTML = '';
  for (let visRow = 0; visRow < 8; visRow++) {
    for (let visCol = 0; visCol < 8; visCol++) {
      const row = boardFlipped ? 7 - visRow : visRow;
      const col = boardFlipped ? 7 - visCol : visCol;
      const cellPiece = board[row][col];
      const sqName = String.fromCharCode(97 + col) + (8 - row);
      const div = document.createElement('div');
      const isLight = (row + col) % 2 === 0;
      div.className = 'sq ' + (isLight ? 'light' : 'dark');
      div.style.position = 'relative'; // Rozetin sağ üstte hizalanması için gerekli
      
      if (cellPiece) {
        const graphic = document.createElement('div');
        graphic.className = `piece-graphic ${cellPiece.type}-${cellPiece.color}`;
        div.appendChild(graphic);
      }

       if (sqName === highlightTo && evaluationCls) {
        const badge = document.createElement('div');
        badge.style.position = 'absolute';
        badge.style.top = '2px';           // Sağ üst köşeye daha yakın hizalama
        badge.style.right = '2px';
        badge.style.width = '24px';        // Genişlik büyütüldü (eski: 18px)
        badge.style.height = '24px';       // Yükseklik büyütüldü (eski: 18px)
        badge.style.borderRadius = '50%';
        badge.style.display = 'flex';
        badge.style.alignItems = 'center';
        badge.style.justifyContent = 'center';
        badge.style.fontSize = '13px';     // Yazı/Emoji boyutu büyütüldü (eski: 10px)
        badge.style.fontWeight = 'bold';
        badge.style.zIndex = '10';
        badge.style.boxShadow = '0 2px 4px rgba(0,0,0,0.4)';
        badge.style.border = '2px solid white'; // Çerçeve kalınlığı artırıldı

        // Sitenize göre özelleştirebileceğiniz sembol ve renk ayarları
        const badgeConfig = {
          book:     { bg: '#5c6bc0', color: '#ffffff', symbol: '📖' }, // Kitap Hamlesi / Book Move (Yeni)
          genius:   { bg: '#00bcd4', color: '#ffffff', symbol: '💎' }, // Çok İyi Hamle / Brilliant
          sharp:    { bg: '#81b64c', color: '#ffffff', symbol: '⭐' }, // En İyi Hamle / Great
          optimum:  { bg: '#8bc34a', color: '#ffffff', symbol: '✓' }, // İyi Hamle / Best
          optimum2: { bg: '#f3ae16', color: '#ffffff', symbol: '⚠️' }, // Şüpheli hamle
          flaw:     { bg: '#fa412d', color: '#ffffff', symbol: '❓' }, // Kötü Hamle / Inaccuracy
          fatal:    { bg: '#ca3431', color: '#ffffff', symbol: '❌' }, // Çok Kötü Hamle / Blunder
          unknown:  { bg: '#5a6472', color: '#ffffff', symbol: '—' }  // Analiz verisi alınamadı
        };

        const config = badgeConfig[evaluationCls];
        if (config) {
          badge.style.backgroundColor = config.bg;
          badge.style.color = config.color;
          badge.textContent = config.symbol; // Buraya dilediğiniz emoji, harf veya karakteri yazabilirsiniz
          div.appendChild(badge);
        }
      }

      boardEl.appendChild(div);
    }
  }
  renderCoordLabels();
}


function renderCoordLabels() {
  if (!coordsTop) return;
  const files = [];
  const ranks = [];
  for (let visCol = 0; visCol < 8; visCol++) {
    const col = boardFlipped ? 7 - visCol : visCol;
    files.push(String.fromCharCode(97 + col));
  }
  for (let visRow = 0; visRow < 8; visRow++) {
    const row = boardFlipped ? 7 - visRow : visRow;
    ranks.push(8 - row);
  }
  const buildSpans = arr => arr.map(v => `<span>${v}</span>`).join('');
  coordsTop.innerHTML = buildSpans(files);
  coordsBottom.innerHTML = buildSpans(files);
  coordsLeft.innerHTML = buildSpans(ranks);
  coordsRight.innerHTML = buildSpans(ranks);
}
function squareToXY(sqName) {
  const cell = 60;
  let col = fileIndex(sqName);
  let row = rankIndexFromTop(sqName);
  if (boardFlipped) { col = 7 - col; row = 7 - row; }
  return { x: col * cell + cell / 2, y: row * cell + cell / 2 };
}
function drawArrow(fromSq, toSq, color) {
  arrowOverlay.innerHTML = '';
  if (!fromSq || !toSq) return;
  const p1 = squareToXY(fromSq), p2 = squareToXY(toSq);
  const ns = 'http://www.w3.org/2000/svg';
  const markerId = 'arrowhead-glow';
  const defs = document.createElementNS(ns, 'defs');
  const marker = document.createElementNS(ns, 'marker');
  marker.setAttribute('id', markerId);
  marker.setAttribute('markerWidth', '8'); marker.setAttribute('markerHeight', '8');
  marker.setAttribute('refX', '4'); marker.setAttribute('refY', '4'); marker.setAttribute('orient', 'auto');
  const poly = document.createElementNS(ns, 'polygon');
  poly.setAttribute('points', '0,0 8,4 0,8'); poly.setAttribute('fill', color);
  marker.appendChild(poly); defs.appendChild(marker); arrowOverlay.appendChild(defs);
  const line = document.createElementNS(ns, 'line');
  line.setAttribute('x1', p1.x); line.setAttribute('y1', p1.y);
  line.setAttribute('x2', p2.x); line.setAttribute('y2', p2.y);
  line.setAttribute('stroke', color); line.setAttribute('stroke-width', '7');
  line.setAttribute('stroke-linecap', 'round'); line.setAttribute('opacity', '0.9');
  line.setAttribute('marker-end', `url(#${markerId})`);
  arrowOverlay.appendChild(line);
}
const CLS_INFO = {
  genius:   { label: 'Parlak Hamle',    desc: 'Bulunması çok zor, fedakarlık içeren mükemmel bir hamle.' },
  sharp:    { label: 'Keskin Hamle',    desc: 'Tek doğru devam buydu; alternatifler avantajı elden kaçırırdı.' },
  optimum:  { label: 'En İyi Hamle',    desc: 'Motorun önerisiyle aynı veya ona çok yakın, güçlü bir seçim.' },
  optimum2: { label: 'İyi Hamle',       desc: 'Konumu bozmayan makul bir hamle, ancak daha güçlü bir alternatif vardı.' },
  flaw:     { label: 'Hatalı Hamle',    desc: 'Bu hamle avantajın bir kısmının elden kaçmasına neden oldu.' },
  fatal:    { label: 'Ciddi Hata',      desc: 'Bu hamle pozisyonu ciddi şekilde zayıflattı.' },
  book:     { label: 'Açılış Teorisi',  desc: 'Bilinen açılış teorisine uygun, standart bir hamle.' },
  unknown:  { label: 'Analiz Yok',      desc: 'Bu pozisyon için motor/analiz verisi alınamadı (ağ hatası olabilir).' }
};
function updateCommentary(move, prevFen) {
  if (!commentaryCard) return;
  if (!move) {
    commentaryCard.style.display = 'none';
    return;
  }
  const info = CLS_INFO[move.cls] || { label: move.cls, desc: '' };
  commentaryCard.style.display = 'block';
  if (commBadge) {
    commBadge.textContent = info.label;
    commBadge.style.background = `var(${CLASS_VAR[move.cls]})`;
    commBadge.style.color = '#0b0f19';
  }
  if (commTitle) commTitle.textContent = `${move.san}  (${formatScore(move.evalAfter)})`;
  if (commText) commText.textContent = info.desc;
  const showPv = !!move.pv && !['optimum', 'genius', 'book'].includes(move.cls);
  if (commPvContainer && commPvText) {
    if (showPv) {
      commPvText.textContent = formatPv(prevFen, move.pv);
      commPvContainer.classList.remove('hidden');
    } else {
      commPvContainer.classList.add('hidden');
    }
  }
}
function goToPly(ply) {
  currentPly = Math.max(0, Math.min(state.fens.length - 1, ply));
  const fen = state.fens[currentPly];
  const move = currentPly > 0 ? state.perMove[currentPly - 1] : null;
  const prevFen = currentPly > 0 ? state.fens[currentPly - 1] : null;
  renderBoard(fen, move ? move.to : null, move ? move.cls : null);
  updateCommentary(move, prevFen);
  if (currentPly === 0) {
    plyLabel.textContent = 'Başlangıç Konumu';
    arrowOverlay.innerHTML = '';
  } else {
    const moveNumber = Math.ceil(currentPly / 2);
    const colorLabel = move.color === 'w' ? 'Beyaz' : 'Siyah';
    plyLabel.textContent = `${moveNumber}. ${colorLabel}: ${move.san}`;
    if (move.cls !== 'optimum' && move.cls !== 'genius' && move.bestSan && move.bestSan !== move.san) {
      const g = new Chess(prevFen);
      const verboseMoves = g.moves({ verbose: true });
      const engineBestMoveObj = verboseMoves.find(mv => mv.san === move.bestSan);
      if (engineBestMoveObj) drawArrow(engineBestMoveObj.from, engineBestMoveObj.to, 'var(--optimum)');
      else arrowOverlay.innerHTML = '';
    } else {
      arrowOverlay.innerHTML = '';
    }
  }
  prevBtn.disabled = currentPly === 0;
  nextBtn.disabled = currentPly === state.fens.length - 1;
  const prevActive = moveListEl.querySelector('.move-chip.active');
  if (prevActive) prevActive.classList.remove('active');
  const activeChip = moveListEl.querySelector(`.move-chip[data-ply="${currentPly}"]`);
  if (activeChip) {
    activeChip.classList.add('active');
    activeChip.scrollIntoView({ block: 'nearest' });
  }
}
function fileIndex(sq) { return sq.charCodeAt(0) - 97; }
function rankIndexFromTop(sq) { return 8 - parseInt(sq[1], 10); }
prevBtn.addEventListener('click', () => goToPly(currentPly - 1));
nextBtn.addEventListener('click', () => goToPly(currentPly + 1));
document.addEventListener('keydown', (e) => {
  if (!state) return;
  if (e.key === 'ArrowLeft') goToPly(currentPly - 1);
  else if (e.key === 'ArrowRight') goToPly(currentPly + 1);
});
analyzeBtn.addEventListener('click', runAnalysis);
renderBoard('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', null, null);

// script.js dosyasının en sonuna sadece bu bloğu yapıştırın:

document.getElementById('backToSetupBtn').addEventListener('click', () => {
    document.getElementById('reviewLayout').classList.remove('active');
    document.getElementById('mainSetupPanel').style.display = 'block';
    document.getElementById('mainHeader').style.display = 'block';
    document.getElementById('mainFooter').style.display = 'block';    
    state = null;
    currentPly = 0;
    
    pgnInput.value = '';
    
    document.getElementById('fileStatusText').textContent = '';
    document.getElementById('analyzeBtn').disabled = false;

    const openingCard = document.getElementById('openingCard');
    if (openingCard) openingCard.style.display = 'none';
    if (commentaryCard) commentaryCard.style.display = 'none';
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
  const moves = pvString.split(/\s+/);
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
