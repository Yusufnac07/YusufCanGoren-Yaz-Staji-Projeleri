# Veritabani Benchmark: Redis Sorted Set (ZSET) vs. PostgreSQL (B-Tree)

Bu benchmark calismasi; yuksek eszamanlilikta sirali veri getirme (leaderboard / ranking) ihtiyaclarinda, iliskisel veritabani (PostgreSQL) ile bellek ici NoSQL (Redis) performansini 100.000 kayit uzerinde karsilastirmak icin kurgulanmistir.

---

## 1. Problem ve Metodoloji

100.000 kullanicili bir sistemde en yuksek puanli ilk 50 kaydin (`LIMIT 50`) cekilmesi iki farkli mimaride test edilmistir:

1. **PostgreSQL 15:** `leaderboard` tablosu uzerinde `xp DESC` B-Tree indeksi.
2. **Redis 7:** `leaderboard_zset` anahtari altinda Sorted Set (Skip List + Hash Map).

### Karmaşıklık Analizi:
| Bilesen | PostgreSQL (B-Tree) | Redis (ZSET) |
|---|---|---|
| Veri Yapisi | B+ Tree (Disk / Buffer Pool) | Skip List + Hash Map (Bellek ici RAM) |
| Arama Karmaşıklığı | $O(\log N + M)$ (Disk I/O maliyetli) | $O(\log N + M)$ (RAM isaretci takibi) |
| Veri Aktarimi | Batch `execute_values` | Pipelined TCP soket yazimi |

*(N = 100.000, M = 50)*

---

## 2. Benchmark Sonuclari

100.000 kayit uzerinde 5 kosunun ortalamasi:

```text
[100000] kayit uzerinde benchmark hazirlaniyor...
PostgreSQL'e veri aktariliyor (batch execute_values)...
Redis'e veri aktariliyor (pipelined ZADD)...

------------------------------------------------
SIRALAMA PERFORMANS BENCHMARK'I (5 Kosu Ortalamasi)
------------------------------------------------
PostgreSQL (B-Tree Index) : 34.20 ms
Redis (ZSET Skip List)    : 0.85 ms
Performans Farki          : Redis 40.2x daha dusuk gecikme sagladi.
------------------------------------------------
```

---

## 3. Kurulum ve Calistirma

### 1. Test Servislerini Baslatma (Docker):
```bash
docker compose up -d
```

### 2. Bagimliliklar:
```bash
pip install psycopg2-binary redis
```

### 3. Benchmark'i Calistirma:
```bash
python redis_vs_sql_benchmark.py
```
