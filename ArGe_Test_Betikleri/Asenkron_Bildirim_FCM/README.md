# Asenkron Bildirim Dagitimi: FCM Batching ve Asyncio Olay Dongusu

Bu calisma, mobil istemcilere kitlesel anlik bildirim (push notification) iletimi sirasinda olusan ag ve I/O gecikmelerini optimize etmek amaciyla, Firebase Cloud Messaging (FCM) v1 kota kurallari ve Python `asyncio` kutuphanesi temel alinarak gelistirilmistir.

---

## 1. Problem Tanimi ve Amac

Kitlesel bildirim senaryolarinda 10.000 istemciye tekil HTTP istekleri atmak ag soketlerini ve islemciyi gereksiz yere mesgul eder:

- **Senkron Istek Yaklasimi:**
  Her bir HTTP POST isteginin ortalama 50 ms RTT (Round-Trip Time) gerektirdigi varsayildiginda:
  $$T_{\text{senkron}} = 10.000 \times 0.05\,\text{s} = 500\,\text{sn} \approx 8.3\,\text{dakika}$$

- **FCM Batching Sinirlari:**
  Firebase Cloud Messaging HTTP v1 API'si `send_each_for_multicast` operasyonunda tek bir payload icerisinde en fazla **500 cihaz token'ina** izin vermektedir. 10.000 kullanici icin $10.000 / 500 = 20$ adet toplu paket olusturulmalidir.

- **Asenkron Multiplexing:**
  Bu 20 paketi ardil gondermek yerine `asyncio.gather` ile tek bir olay dongusunde concurrent olarak gondermek gecikmeyi tek bir istegin gecikme seviyesine ceker:
  $$T_{\text{async}} \approx \max(t_i) \approx 0.06\,\text{sn}$$

---

## 2. Mimari ve Calisma Mantigi

```
[10.000 FCM Cihaz Token'i]
            │
            ▼ (500'luk Dilimleme)
[Batch 1] [Batch 2] ... [Batch 20]
    │         │             │
    └─────────┼─────────────┘
              ▼
      asyncio.gather()
  [Asyncio Event Loop (I/O Multiplexing)]
              │
              ▼
   Sonuc: ~0.06 saniyede tamamlanma
```

1. **Bellek Ici Dilimleme:** Liste kopyalamayi minimize eden dilimleme (`[i : i + BATCH_SIZE]`) kullanilarak 500'erli paketler olusturulur.
2. **Cooperative Multitasking:** `mock_fcm_send` coroutine'i I/O beklerken (`await`), Python olay dongusu diger batch isteklerinin soketlerini yonetir.

---

## 3. Test Sonuclari

10.000 ornek token uzerinde alinan konsol ciktisi:

```text
Toplam 10000 istemci icin bildirim dagitimi baslatiliyor...
Istemciler 500'lik 20 pakete bolundu.
---------------------------------------------
FCM ASYNC BATCH TEST SONUCLARI
---------------------------------------------
Basarili Iletim : 10000
Toplam Gecikme  : 0.0610 sn
Throughput      : 163934.4 bildirim/sn
---------------------------------------------
```

---

## 4. Calistirma

Python standart kutuphanesi (`asyncio`, `secrets`, `time`) kullanildigindan harici bagimlilik gerektirmez:

```bash
python fcm_batch_notification.py
```
