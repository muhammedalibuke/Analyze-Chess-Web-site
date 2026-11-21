# Analyze-Chess-Web-site

Tarayıcıda çalışan satranç parti inceleme uygulaması. PGN yüklenir; her pozisyon bulut kaynakları
(Lichess Tablebase, ChessDB, Lichess Cloud Eval) veya yerel Stockfish ile analiz edilir, hamleler
sınıflandırılır ve oyuncuların doğruluk oranı hesaplanır.

Uygulama dosyaları `Chess/` klasöründedir (`index.html`, `style.css`, `script.js`).

## Çalıştırma

`script.js` bir ES modülü olduğu için `index.html` dosyaya çift tıklanarak (`file://`) açılınca
çalışmaz; bir web sunucusu üzerinden açılmalıdır:

- **GitHub Pages:** Repo → *Settings* → *Pages* → *Source: Deploy from a branch* → `main` / `(root)`
  → *Save*. Birkaç dakika sonra site şu adreste açılır:
  `https://muhammedalibuke.github.io/Analyze-Chess-Web-site/Chess/`
- **Yerelde:** `Chess` klasöründe `python -m http.server 8000` çalıştırıp
  `http://localhost:8000` adresini açın.

## Nasıl kontrol edilir?

1. Siteyi açın, **Örnek Parti Yükle** → **Analiz Et**'e basın (Morphy'nin "Opera Partisi").
2. Beklenen sonuçlar:
   - **13.Rxd7** (kale fedası) → 💎 *Parlak Hamle*; 12.O-O-O, 14.Rd1 gibi hamleler → ⭐ *Keskin*.
     (Eskiden bu iki sınıf hiç görünmüyordu.)
   - **10...cxb5** ve **11...Nbd7** → ❌ *Ciddi Hata* (Siyah'ın partiyi kaybettiren hamleleri).
   - "Açılış Teorisi" kartında **Philidor Defense [C41]** yazar (PGN'de açılış bilgisi olmasa bile).
   - Sadece gerçekten teoride olan ilk hamleler 📖 alır; 3...Bg4 gibi teoriden sapan hamleler almaz.
3. Tarayıcı konsolunda (F12) kırmızı hata olmamalı. Bulut API'lerinden biri cevap vermezse sarı
   uyarı (`console.warn`) görülebilir; bu normaldir, analiz yerel motora geçer.

## Değişiklik notları

### Analiz düzeltmeleri

Tüm değişiklikler `Chess/script.js` içinde `[DÜZELTME #n]` yorumlarıyla işaretlidir.

| # | Sorun | Etkisi | Düzeltme |
|---|---|---|---|
| 1 | Lichess Cloud Eval puanları **Beyaz'ın** bakış açısından gelir, kod ise sırası gelen tarafa göre varsayıyordu. | Siyah'ın sırası olan pozisyonlarda puan ters çıkıyor, iyi hamleler "Ciddi Hata" görünebiliyordu. | Siyah'ın sırasıysa işaret bir kez çevriliyor. Mat puanları da aynı şekilde. |
| 2 | Tablebase'den gelen `dtm` (mata kalan yarım hamle) santipiyon puanı gibi kullanılıyordu; `checkmate: true` ise +10000 veriliyordu. | "15 hamlede mat" +0.15 okunuyordu; mat olmuş taraf kazanıyor görünüyordu. | `category` alanı (win/loss/draw, cursed-win…) kullanılıyor; mat olmuş taraf −mat alıyor. Hamle kategorilerinin rakibin bakış açısında olduğu hesaba katılıyor. |
| 3 | `score2` (ikinci en iyi hamle) hiçbir kaynaktan gelmiyordu: Stockfish'e `MultiPV` ayarı verilmemişti, bulut kaynakları da döndürmüyordu. | "Parlak" ve "Keskin" sınıfları hiç verilemiyordu. | Stockfish `MultiPV 2`, Lichess `multiPv=3`, ChessDB ve tablebase'in tüm hamle listesi kullanılıyor. "En iyi hamle mi?" kontrolü artık motorun önerdiği hamleyle doğrudan karşılaştırılıyor. |
| 4 | Hamle kaybı, iki **farklı** pozisyonun puan farkından hesaplanıyordu; bu pozisyonlar farklı motorlardan (ör. ChessDB ve derinlik 13 Stockfish) gelebiliyordu. | Motorlar arası görüş farkı "hata" olarak görünüyordu. | Kayıp mümkünse **aynı analizden** hesaplanıyor: en iyi hamlenin puanı − oynanan hamlenin puanı. Puanlar ±1000'e sıkıştırılıyor (mat / tablebase kazancı ölçek farkı sahte hata üretmesin). Stockfish her pozisyondan önce `ucinewgame` ile sıfırlanıyor; aynı parti her analizde aynı sonucu veriyor. Doğruluk oranı da aynı puanlardan hesaplanıyor. |
| 5 | İlk 8 hamlede 100 cp'den az kaybettiren her hamle "kitap" sayılıyordu (1.e4 e5 2.Qh5 bile). Elle yazılmış 2 pozisyonluk `OPENING_BOOK` da yanlış işaretli puan içeriyordu. | Kitap etiketi anlamsızdı; açılıştaki hatalar doğruluk hesabından düşüyordu. | Lichess'in açık lisanslı (CC0) [chess-openings](https://github.com/lichess-org/chess-openings) veritabanı (~3.800 hat, ~8.000 pozisyon) yükleniyor. Hamle sonrası pozisyon bu veritabanında varsa ve en fazla 80 cp kaybettiriyorsa "Açılış Teorisi" sayılıyor. Bonus: PGN'de `[Opening]` başlığı yoksa açılış adı veritabanından bulunuyor. |

Ayrıca:

- ChessDB JSON cevabında hamle alanının adı `uci`'dir; kod `move` okuduğu için ChessDB'den gelen en
  iyi hamle hep `undefined` oluyordu (tahtada öneri oku çizilmiyordu). Düzeltildi.
- Lichess'in rok hamlesini `e1h1` biçiminde yazma ihtimaline karşı hamleler standart UCI'ye
  (`e1g1`) çevriliyor.

### Repo senkronizasyonu

Repodaki eski `script.js`'te sözdizimi hataları vardı (`Ply(currentPly); goTo` ve fonksiyon dışında
kalmış bir `await` bloğu), bu yüzden site açılmıyordu. Repo, geliştirilmiş son sürümle güncellendi
(`index.html`, `script.js`, `style.css`). Taş görselleri değişmedi.

### Test

Değişiklikler Node.js üzerinde, sayfa jsdom içinde yüklenip gerçek Stockfish 10 ile Opera Partisi
analiz edilerek ve her bulut kaynağı için örnek API cevaplarıyla (Lichess, tablebase, ChessDB)
test edildi.
