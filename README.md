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

## Parti yükleme yolları

- **Hesaptan getir:** Lichess ya da Chess.com kullanıcı adını yaz → son 20 parti listelenir →
  birine tıkla, analiz başlar. Tahta otomatik olarak senin rengine çevrilir. Lichess parti linki
  (`https://lichess.org/xxxxxxxx`) de yapıştırılabilir. Lichess ve Chess.com'un herkese açık
  API'leri kullanılır, giriş gerekmez.
- **Dosya yükle:** `.pgn` dosyası sürükle/seç. Dosyada birden fazla parti varsa liste çıkar, birini seçersin.
- **Metni yapıştır:** PGN metni (Türkçe notasyon da olur).

İnceleme ekranındaki **PGN'i indir** düğmesi partiyi `.pgn` dosyası olarak kaydeder.

## Doğruluk oranı nasıl hesaplanır?

Lichess'in yöntemiyle (açık kaynak lila kodundaki `AccuracyPercent`): her hamlenin doğruluğu,
hamleyi yapanın kazanma yüzdesindeki düşüşten hesaplanır; oyun doğruluğu, keskin anlara daha çok
ağırlık veren ağırlıklı ortalama ile harmonik ortalamanın ortalamasıdır. Böylece birkaç büyük hata
oranı gerçekçi biçimde düşürür. Lichess'in kendi analiz ettiği iki partide karşılaştırma:

| Parti | Lichess (Beyaz / Siyah) | Bu site (Beyaz / Siyah) |
|---|---|---|
| lichess.org/2gQjWI17 (87 yarım hamle) | %49 / %52 | %48.0 / %49.9 |
| lichess.org/ltjb7DJd (30 yarım hamle) | %53 / %79 | %54.9 / %86.0 |

Küçük farklar, değerlendirmelerin farklı motorlardan/derinliklerden gelmesinden kaynaklanır.

## Güncelleme yaparken

`index.html` içindeki `style.css?v=…` ve `script.js?v=…` numaralarını her sürümde bir artırın.
Aksi halde tarayıcı/CDN önbelleği yeni sayfayı eski stil dosyasıyla birleştirip sayfayı bozuk
gösterebilir. Taş görselleri `Chess/pieces/` klasöründedir.

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

### Görünüm yenilemesi

- **Tailwind CDN kaldırıldı.** Sitenin kendi CSS'inden sonra yüklendiği için başlık, açılır menü gibi
  öğelerin stilini eziyordu (başlık küçük görünüyordu) ve konsolda "production'da kullanmayın"
  uyarısı veriyordu. Tüm stil artık `style.css`'te.
- **Giriş ekranı:** net bir başlık ve açıklama, sekmeli yükleme kutusu, hamle sınıflarının
  açıklaması; geniş ekranlarda sağda örnek pozisyon (Morphy'nin 13.Rxd7!! hamlesi; tıklayınca
  örnek parti analiz edilir).
- **İnceleme ekranı:**
  - Tahtanın yanında **değerlendirme çubuğu**, altında tıklanabilir **avantaj grafiği**
    (hatalar ve parlak hamleler noktayla işaretli).
  - Tahtanın üstünde/altında oyuncu adları ve doğruluk; üst barda oyuncular, sonuç, açılış ve turnuva.
  - Hamle listesinde sınıf renkleri ve satranç işaretleri (!!, !, ?, ??, kitap simgesi).
  - Doğruluk kartında her oyuncu için hangi sınıftan kaç hamle yaptığı.
  - Yorum kartında değerlendirme değişimi (ör. +4.07 → +7.17), "Daha iyisi" önerisi ve motor devamı.
  - Gezinme: baş/son düğmeleri, tahtayı çevirme; klavyede ← → Home End ve F (çevir).
  - Önerilen hamle oku artık hedef kareye tam oturuyor (eskiden bir kare taşıyordu).
  - Tüm sınıflar tek renk/simge setini kullanıyor (eskiden tahta rozeti, liste ve kart farklıydı).
- **Mobil:** hamle listesinin kesilmesi ve alttaki kartların görünmemesi düzeltildi; tahta,
  grafik, yorum, doğruluk ve hamle listesi alt alta sıralanıyor.
- Tahta ve kontroller masaüstünde tek ekrana sığacak şekilde boyutlanıyor.
- PGN'de başlık satırlarıyla hamleler arasında boş satır yoksa (yapıştırılan PGN'lerde sık)
  oyuncu adları kayboluyordu; düzeltildi.

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
