import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@0.13.4/chess.js';
const CLASS_VAR = { 
  genius: '--genius', 
  sharp: '--sharp', 
  optimum: '--optimum', 
  optimum2: '--optimum2', 
  flaw: '--flaw', 
  fatal: '--fatal',
  book: '--book' // Açılış hamlesi sınıfı eklendi
};
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
const SAMPLE_PGN = `[Event "Opera Game"]
[White "Paul Morphy"]
[Black "Duke of Brunswick & Count Isouard"]
[Result "1-0"]
1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7
8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8
13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`;
const OPENING_BOOK = {
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1": { score: {type: "cp", value: 35}, bestMoveUci: "e2e4", pv: "e4 e5 Nf3 Nc6 Bc4 Nf6" },
  "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1": { score: {type: "cp", value: 40}, bestMoveUci: "e7e5", pv: "e5 Nf3 d6 d4 exd4" }
};
const pgnInput = document.getElementById('pgnInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const sampleBtn = document.getElementById('sampleBtn');
const depthSelect = document.getElementById('depthSelect');
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
  analyze(fen, depth) {
    return new Promise((resolve, reject) => {
      let bookKey = fen;
      if (!OPENING_BOOK[bookKey]) {
        if (fen.includes("g6")) bookKey = fen + " (Modern)";
        else if (fen.includes("c6")) bookKey = fen + " (Caro)";
        else if (fen.includes("e6")) bookKey = fen + " (French)";
        else if (fen.includes("c5")) bookKey = fen + " (Sicilian)";
      }
      if (OPENING_BOOK[bookKey]) {
        resolve(OPENING_BOOK[bookKey]);
        return;
      }
      const wObj = this.getFreeWorker();
      const finalWObj = wObj ? wObj : this.workers[0];
      const slotIndex = this.workers.indexOf(finalWObj);
      finalWObj.busy = true;
      const worker = finalWObj.worker;
      const lastScores = {};
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
            if (pvMatch && (!mpvMatch || mpvMatch[1] === '1')) {
              currentPv = pvMatch[1];
            }
          } else if (line.startsWith('bestmove')) {
            if (settled) return;
            settled = true;
            cleanup();
            finalWObj.busy = false;
            const parts = line.split(' ');
            resolve({ 
              score: lastScores[1] || null, 
              score2: lastScores[2] || null, 
              bestMoveUci: parts[1],
              pv: currentPv
            });
          }
        }
      };
      worker.addEventListener('message', handler);
      worker.addEventListener('error', onWorkerError);
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

function classifyMove({ loss, gapBefore, isBest, sac, ply }) {
  // AÇILIŞ KORUMASI: İlk 8 hamlede (ply < 16) yapılan ve 100 CP kaybını aşmayan hamleler 'book' kabul edilir.
  if (ply < 16 && loss <= 100) {
    return 'book'; 
  }

  // ... (Geri kalan kodlar aynı kalacak)
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
    // AÇILIŞ KORUMASI: Kitap hamlelerini (book) doğruluğu yapay yükseltmesin diye hesaba katmıyoruz
    if (state.perMove[i] && state.perMove[i].cls === 'book') {
      continue; 
    }
    
    const moverIsWhite = state.moves[i].color === 'w';
    const evalBeforeMover = moverIsWhite ? state.evals[i] : -state.evals[i];
    const evalAfterMover = moverIsWhite ? state.evals[i + 1] : -state.evals[i + 1];
    const winBefore = cpToWinPercent(evalBeforeMover);
    const winAfter = cpToWinPercent(evalAfterMover);
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
      wChip.style.textTransform = 'none'; // CSS dosyasındaki harf büyütme zorlamalarını iptal eder (e4'ü korur)
      wChip.style.fontWeight = '500';
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
      bChip.style.textTransform = 'none'; // CSS dosyasındaki harf büyütme zorlamalarını iptal eder (e4'ü korur)
      bChip.style.fontWeight = '500';
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
    
    if (!raw.trim()) { 
        showError('Hata: PGN verisi girilmedi.'); 
        return; 
    }
    
    console.log("Analiz başlatılıyor...");
    analyzeBtn.disabled = true;
    statusRow.classList.add('active');
    statusLine.textContent = 'Motor hazırlanıyor...';

    try {
        // Motoru başlat
        await pool.init(parseInt(depthSelect.value, 10));
        
        // 'parsed' değişkenini burada tanımla
        const parsed = parsePgn(raw);
        
        statusLine.textContent = 'Analiz devam ediyor: ' + parsed.moves.length + ' hamle.';
        
        const fens = parsed.fens;
        const depth = parseInt(depthSelect.value, 10);

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

        const perMove = [];
        for (let i = 0; i < parsed.moves.length; i++) {
            const mv = parsed.moves[i];
            const moverIsWhite = mv.color === 'w';
            
            let evalBeforeMover = moverIsWhite ? evals[i] : -evals[i];
            let evalAfterMover = moverIsWhite ? evals[i + 1] : -evals[i + 1];
            
            let cpLoss = 0;
            let cls = 'optimum';

            // 1. KORUMA: Eğer hamle mat yapıyorsa (#), kayıp sıfırdır ve doğrudan en iyi hamledir.
            if (mv.san.endsWith('#')) {
                cpLoss = 0;
                cls = 'optimum';
            } else {
                // 2. KORUMA: Puanlardan biri boşsa (motor hatası/zaman aşımı), kaybı 0 kabul et
                if (evalBeforeMover === null || evalAfterMover === null) {
                    cpLoss = 0;
                } else {
                    cpLoss = Math.max(0, evalBeforeMover - evalAfterMover);
                }

                // Her hamle öncesindeki pozisyonun motor sonuçlarından gapBefore değerini hesaplıyoruz
                let gapBefore = null;
                const engineResult = results[i];
                if (engineResult && engineResult.score && engineResult.score2) {
                    const cpBest = normalizeScore(engineResult.score, moverIsWhite);
                    const cpSecondBest = normalizeScore(engineResult.score2, moverIsWhite);
                    gapBefore = Math.abs(cpBest - cpSecondBest);
                }

                cls = classifyMove({ 
                  loss: cpLoss, 
                  gapBefore: gapBefore, 
                  isBest: cpLoss <= 10, 
                  sac: isSacrifice(mv),
                  ply: i
                });
            }

            perMove.push({ 
              san: mv.san, 
              color: mv.color, 
              from: mv.from, 
              to: mv.to, 
              cls, 
              bestSan: bestMoveSanAt[i],
              pv: results[i] ? results[i].pv : '',
              evalBefore: evals[i],
              evalAfter: evals[i + 1]
            });
        }

        state = { headers: parsed.headers, moves: parsed.moves, fens, evals, bestMoveSanAt, perMove };
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
        if (openingCard && openingNameText && state.headers && (state.headers.Opening || state.headers.ECO)) {
          const name = state.headers.Opening || "Bilinmeyen Açılış Teorisi";
          const eco = state.headers.ECO ? ` [${state.headers.ECO}]` : "";
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

        Ply(currentPly);
        syncAnalysisHeight();
        goTo
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

function renderBoard(fen, highlightFrom, highlightTo, hlColorVar, evaluationCls) {
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
          fatal:    { bg: '#ca3431', color: '#ffffff', symbol: '❌' }  // Çok Kötü Hamle / Blunder
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
function goToPly(ply) {
  currentPly = Math.max(0, Math.min(state.fens.length - 1, ply));
  const fen = state.fens[currentPly];
  const move = currentPly > 0 ? state.perMove[currentPly - 1] : null;
  const hlVar = move ? CLASS_VAR[move.cls] : null;
  
  renderBoard(fen, null, move ? move.to : null, null, move ? move.cls : null);

  // --- Motor Yorum Kartı Yönetimi ---
  if (currentPly === 0 || !move) {
    plyLabel.textContent = 'Başlangıç Konumu';
    arrowOverlay.innerHTML = '';
    commentaryCard.style.display = 'none'; // Başlangıç konumunda kartı gizle
  } else {
    const moveNumber = Math.ceil(currentPly / 2);
    const colorLabel = move.color === 'w' ? 'Beyaz' : 'Siyah';
    plyLabel.textContent = `${moveNumber}. ${colorLabel}: ${move.san}`;

    // Açıklama kartını görünür kıl
    commentaryCard.style.display = 'block';

    // Renk ve Rozet Haritası
    const configMap = {
      book:     { text: 'Teori', bg: '#5c6bc0', symbol: '📖' },
      genius:   { text: 'Çok İyi Hamle', bg: '#00bcd4', symbol: '💎' },
      sharp:    { text: 'En İyi Seçenek', bg: '#81b64c', symbol: '⭐' },
      optimum:  { text: 'En İyi Hamle', bg: '#8bc34a', symbol: '✓' },
      optimum2: { text: 'Şüpheli Hamle', bg: '#f3ae16', symbol: '⚠️' },
      flaw:     { text: 'Hata', bg: '#fa412d', symbol: '❓' },
      fatal:    { text: 'Çok Kötü Hamle', bg: '#ca3431', symbol: '❌' }
    };

    const cfg = configMap[move.cls] || { text: 'Analiz Edildi', bg: '#718096', symbol: '⚙️' };
    
    // Rozet Güncellemesi
    commBadge.style.backgroundColor = cfg.bg;
    commBadge.textContent = `${cfg.symbol} ${cfg.text}`;
    
    // Değerlendirme Metni
    const scoreBeforeStr = formatScore(move.evalBefore);
    const scoreAfterStr = formatScore(move.evalAfter);
    commTitle.textContent = `${move.san} (${scoreBeforeStr} → ${scoreAfterStr})`;

    // Hamle Yorum Yazısı
    let commentText = "";
    if (move.cls === 'book') {
      commentText = "Bu hamle bilinen açılış teorisini takip ediyor.";
    } else if (move.cls === 'optimum' || move.cls === 'genius' || move.cls === 'sharp') {
      commentText = "Harika bir tercih! Motor da bu hamleyi onaylıyor.";
    } else {
      commentText = `Hatalı bir tercih. Motor bunun yerine <strong>${move.bestSan || 'başka bir varyantı'}</strong> öneriyor.`;
    }
    commText.innerHTML = commentText;

    // En İyi Varyant / PV Gösterimi
    if (move.pv && (move.cls !== 'optimum' && move.cls !== 'genius' && move.cls !== 'sharp')) {
      const prevFen = state.fens[currentPly - 1];
      const parsedPv = formatPv(prevFen, move.pv);
      if (parsedPv) {
        commPvText.textContent = parsedPv;
        commPvContainer.classList.remove('hidden');
      } else {
        commPvContainer.classList.add('hidden');
      }
    } else {
      commPvContainer.classList.add('hidden');
    }

    // Ok çizimi kontrolü
    if (move.cls !== 'optimum' && move.cls !== 'genius' && move.bestSan && move.bestSan !== move.san) {
      const prevFen = state.fens[currentPly - 1];
      const g = new Chess(prevFen);
      const verboseMoves = g.moves({ verbose: true });
      const engineBestMoveObj = verboseMoves.find(mv => mv.san === move.bestSan);
      if (engineBestMoveObj) drawArrow(engineBestMoveObj.from, engineBestMoveObj.to, 'var(--optimum)');
      else arrowOverlay.innerHTML = '';
    } else {
      arrowOverlay.innerHTML = '';
    }
  }

  // Önceki aktif düğmeleri güncelle ve kaydır
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
renderBoard('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', null, null, null);


document.getElementById('backToSetupBtn').addEventListener('click', () => {
    
    document.getElementById('reviewLayout').classList.remove('active');
    document.getElementById('mainSetupPanel').style.display = 'block';
    document.getElementById('mainHeader').style.display = 'block';
    document.getElementById('mainFooter').style.display = 'block';    
    state = null;
    currentPly = 0;
    document.getElementById('pgnInput').value = '';
    document.getElementById('fileStatusText').textContent = '';
    document.getElementById('analyzeBtn').disabled = false;
});

document.getElementById('analyzeBtn').addEventListener('click', runAnalysis);



state = { headers: parsed.headers, moves: parsed.moves, fens, evals, bestMoveSanAt, perMove };
        currentPly = fens.length - 1;

        // Node.js API Entegrasyonu (runAnalysis içerisindeki güvenli konumu)
        try {
            const response = await fetch('http://localhost:3000/api/v1/chess/one/load/over/pgn', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pgnData: raw })
            });
            if (response.ok) {
                const apiSonucu = await response.json();
                console.log("Sunucudan Gelen Analiz Verisi:", apiSonucu);
            }
        } catch (apiErr) {
            console.warn("API Sunucusuna bağlanılamadı:", apiErr.message);
        }

        function getPieceCount(fen) {
  const position = fen.split(' ')[0];
  return position.replace(/[^a-zA-Z]/g, "").length;
}

async function getHybridAnalysis(fen) {
  const pieceCount = getPieceCount(fen);

  // 1. Oyun Sonu Kontrolü (7 veya daha az taş varsa Syzygy Tablebase)
  if (pieceCount <= 7) {
    try {
      const syzygyResp = await fetch(`https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(fen)}`);
      if (syzygyResp.ok) {
        const data = await syzygyResp.json();
        return {
          source: 'syzygy_tablebase',
          score: { type: 'cp', value: data.checkmate ? 10000 : (data.dtm || 0) },
          bestMoveUci: data.moves && data.moves.length > 0 ? data.moves[0].uci : null
        };
      }
    } catch (e) {
      console.warn("Tablebase API hatası:", e);
    }
  }

  // 2. ChessDB Kontrolü (Yüksek derinlikli motor arşivi)
  try {
    const chessDbResp = await fetch(`https://www.chessdb.cn/cdb.php?action=queryall&board=${encodeURIComponent(fen)}&json=1`);
    if (chessDbResp.ok) {
      const data = await chessDbResp.json();
      if (data.status === 'ok' && data.moves && data.moves.length > 0) {
        const bestMove = data.moves[0];
        return {
          source: 'chessdb_cloud',
          score: { type: 'cp', value: bestMove.score },
          bestMoveUci: bestMove.move
        };
      }
    }
  } catch (e) {
    console.warn("ChessDB API hatası:", e);
  }

  // 3. Lichess Cloud Eval Kontrolü
  try {
    const lichessCloudResp = await fetch(`https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}`);
    if (lichessCloudResp.ok) {
      const data = await lichessCloudResp.json();
      if (data.pvs && data.pvs.length > 0) {
        return {
          source: 'lichess_cloud',
          score: {
            type: data.pvs[0].mate ? 'mate' : 'cp',
            value: data.pvs[0].mate || data.pvs[0].cp
          },
          bestMoveUci: data.pvs[0].moves.split(' ')[0]
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
  const val = (cp / 100).toFixed(2);
  return cp > 0 ? `+${val}` : `${val}`;
}

function formatPv(startFen, pvString) {
  if (!pvString) return '';
  const tempGame = new Chess(startFen);
  const moves = pvString.split(/\s+/);
  const formatted = [];
  
  let moveNum = parseInt(startFen.split(' ')[5], 10) || 1;
  let activeColor = startFen.split(' ')[1]; // 'w' or 'b'
  
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