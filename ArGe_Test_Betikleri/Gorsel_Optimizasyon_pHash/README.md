# Gorsel Optimizasyon ve Benzerlik Tespiti: Algi-sal Ozetleme (pHash)

Bu modul, depolama alanini optimize etmek amaciyla sistemdeki mukerrer veya yeniden boyutlandirma/sikistirma sonrasi benzer kalmis gorselleri tespit etmek uzere hazirlanmistir.

---

## 1. Altyapi ve Calisma Mantigi

### Kriptografik Hash vs. Algisal Hash
MD5 ve SHA-256 gibi kriptografik fonksiyonlar cig etkisi (avalanche effect) prensibiyle calisir. Gorseldeki tek bir pikselin degeri veya sikistirma orani degistiginde hash tamamen farklilasir. 
pHash (Perceptual Hash) ise gorselin frekans bilesenlerini analiz ederek gorsel yapisini ozetler; hafif boyut degisimleri ve JPEG sikistirmalarina karsi toleranslidir.

### pHash Matematiksel Asamalari:
1. **Gri Tonlama ve Boyutlandirma:** Gorsel 32x32 matris boyutuna indirgenir.
2. **Ayrik Kosinus Donusumu (2D-DCT):** Piksel degerleri frekans uzayina aktarilir.
3. **Dusuk Frekans Filtreleme:** Insan gozunun en duyarli oldugu sol ust $8 \times 8$ frekans matrisi (64 katsayi) secilir.
4. **Medyan Esikleme:** 64 katsayinin medyani alinarak 64-bitlik (16 hex karakter) benzersiz parmak izi uretilir.

### Hamming Mesafesi (Hamming Distance):
Iki ozet degeri arasindaki fark, bit duzeyindeki XOR islemi (farkli olan bit sayisi) ile hesaplanir:
$$\text{Dist}(H_1, H_2) = \text{popcount}(H_1 \oplus H_2)$$

- **Mesafe = 0:** Tamamen ayni gorsel.
- **Mesafe <= 5:** Ayni gorselin farkli cozunurluk/sikistirma varyanti (kumeleme esigi).
- **Mesafe > 10:** Farkli gorseller.

---

## 2. Karmasiklik ve Olcekleme

- **Ozet Cikarimi:** Sabit $32 \times 32$ giris boyutu nedeniyle gorsel basina $O(1)$, $N$ gorsel icin $O(N)$.
- **Karsilastirma:** Mevcut betikte ikili esleme $O(N^2)$ zaman karmasikligina sahiptir. Milyonlarca gorsel icin BK-Tree veri yapisiyla $O(\log N)$ seviyesine cekilebilir.

---

## 3. Kurulum ve Calistirma

Bagimliliklar:
```bash
pip install Pillow ImageHash
```

Calistirma:
```bash
python phash_image_matcher.py .
```

---

## 4. Test Ciktisi

`foto1.jpg` ve `foto2.jpg` uzerinde yapilan test ciktisi:

```text
Toplam 2 gorsel icin pHash parmak izi cikariliyor...

=============================================
PHASH BENZERLIK ANALIZI
=============================================
Tespit edilen benzerlik kumesi sayisi: 1

Kume #1:
  -> foto1.jpg
  -> foto2.jpg
```
