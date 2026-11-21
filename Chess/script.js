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
    tabFileBtn.setAttribute('aria-selected', 'true');
    tabTextBtn.setAttribute('aria-selected', 'false');
    contentFile.classList.add('active');
    contentText.classList.remove('active');
  });
  tabTextBtn.addEventListener('click', () => {
    tabTextBtn.classList.add('active');
    tabFileBtn.classList.remove('active');
    tabTextBtn.setAttribute('aria-selected', 'true');
    tabFileBtn.setAttribute('aria-selected', 'false');
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
const classCountsEl = document.getElementById('classCounts');
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
function renderAccuracy() {
  const acc = state.accuracies;
  whiteAccEl.textContent = acc.white !== null ? '%' + acc.white.toFixed(1) : '—';
  blackAccEl.textContent = acc.black !== null ? '%' + acc.black.toFixed(1) : '—';
  document.getElementById('accWhiteName').textContent = playerName('w');
  document.getElementById('accBlackName').textContent = playerName('b');

  const counts = { w: {}, b: {} };
  for (const m of state.perMove) counts[m.color][m.cls] = (counts[m.color][m.cls] || 0) + 1;
  classCountsEl.innerHTML = '';
  for (const cls of CLASS_ORDER) {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.scope = 'row';
    th.appendChild(makeBadge(cls));
    th.appendChild(document.createTextNode(CLASS_META[cls].label));
    tr.appendChild(th);
    for (const c of ['w', 'b']) {
      const td = document.createElement('td');
      const n = counts[c][cls] || 0;
      td.textContent = n;
      if (n > 0) td.className = 'has';
      tr.appendChild(td);
    }
    classCountsEl.appendChild(tr);
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

// Masaüstünde sağ sütun tahta sütunuyla aynı yükseklikte olsun (hamle listesi kalan yeri doldurur)
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
window.addEventListener('resize', () => { syncAnalysisHeight(); if (state) renderEvalGraph(); });
if (window.ResizeObserver) {
  const ro = new ResizeObserver(() => { syncAnalysisHeight(); if (state) renderEvalGraph(); });
  ro.observe(document.querySelector('.board-col'));
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
  const H = 96, pad = 6;
  const n = state.fens.length;
  const x = i => (n > 1 ? (i / (n - 1)) * W : 0);
  const y = i => pad + (1 - whiteWinPercent(evalAtPly(i)) / 100) * (H - 2 * pad);
  evalGraphEl.setAttribute('viewBox', `0 0 ${W} ${H}`);
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

document.getElementById('backToSetupBtn').addEventListener('click', () => {
  reviewLayout.classList.remove('active');
  setupView.classList.remove('is-hidden');
  state = null;
  currentPly = 0;
  pgnInput.value = '';
  fileStatusText.textContent = '';
  pgnFileInput.value = '';
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
