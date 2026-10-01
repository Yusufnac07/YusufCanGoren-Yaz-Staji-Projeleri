import asyncio
import time
import secrets

TOTAL_USERS = 10000
# Firebase Cloud Messaging v1 send_each_for_multicast limiti istek basina 500 token'dir.
BATCH_SIZE = 500

async def mock_fcm_send(batch_id: int, token_batch: list[str]) -> int:
    # 50ms ortalama FCM HTTP/2 round-trip gecikmesi simule ediliyor
    await asyncio.sleep(0.05)
    return len(token_batch)

async def send_notifications_in_batches(user_tokens: list[str]):
    print(f"Toplam {len(user_tokens)} istemci icin bildirim dagitimi baslatiliyor...")
    
    batches = [
        user_tokens[i : i + BATCH_SIZE]
        for i in range(0, len(user_tokens), BATCH_SIZE)
    ]
    print(f"Istemciler {BATCH_SIZE}'lik {len(batches)} pakete bolundu.")
    
    tasks = [mock_fcm_send(idx, batch) for idx, batch in enumerate(batches)]
    
    # Tum paketleri tek bir olay dongusunde concurrent olarak cagiriyoruz
    start_time = time.perf_counter()
    results = await asyncio.gather(*tasks)
    elapsed = time.perf_counter() - start_time
    
    print("-" * 45)
    print("FCM ASYNC BATCH TEST SONUCLARI")
    print("-" * 45)
    print(f"Basarili Iletim : {sum(results)}")
    print(f"Toplam Gecikme  : {elapsed:.4f} sn")
    print(f"Throughput      : {len(user_tokens) / elapsed:.1f} bildirim/sn")
    print("-" * 45)

def main():
    # Gercekci FCM registration token ornekleri uretiliyor (FCM v1 formatina yakin)
    user_tokens = [
        f"fcm_{secrets.token_hex(16)}:APA91b{secrets.token_hex(20)}"
        for _ in range(TOTAL_USERS)
    ]
    asyncio.run(send_notifications_in_batches(user_tokens))

if __name__ == "__main__":
    main()