import time
import random
import uuid
import psycopg2
import redis
from psycopg2.extras import execute_values

USER_COUNT = 100000
BENCHMARK_ITERATIONS = 5

def setup_postgres():
    conn = psycopg2.connect(
        dbname="postgres", user="postgres", password="password", host="localhost", port=5432
    )
    cur = conn.cursor()
    cur.execute("DROP TABLE IF EXISTS leaderboard;")
    cur.execute("""
        CREATE TABLE leaderboard (
            id UUID PRIMARY KEY,
            username VARCHAR(50) NOT NULL,
            xp INT NOT NULL
        );
    """)
    # ORDER BY xp DESC LIMIT M sorgusu icin B-Tree indeksi
    cur.execute("CREATE INDEX idx_leaderboard_xp ON leaderboard(xp DESC);")
    conn.commit()
    return conn, cur

def setup_redis():
    return redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)

def generate_dataset(n: int):
    # Gercekci kullanici profilleri ve rastgele XP dagilimi
    prefixes = ["alpha", "byte", "core", "dev", "echo", "flux", "grid", "hyper", "iron", "kilo"]
    suffixes = ["coder", "runner", "hacker", "mind", "ops", "pilot", "smith", "wave", "craft", "node"]
    
    users = []
    redis_data = {}
    for i in range(n):
        uid = str(uuid.uuid4())
        uname = f"{random.choice(prefixes)}_{random.choice(suffixes)}_{i}"
        xp = random.randint(100, 250000)
        users.append((uid, uname, xp))
        redis_data[uname] = xp
    return users, redis_data

def main():
    print(f"[{USER_COUNT}] kayit uzerinde benchmark hazirlaniyor...")
    users, redis_data = generate_dataset(USER_COUNT)

    pg_conn, pg_cur = setup_postgres()
    r = setup_redis()
    r.delete("leaderboard_zset")

    print("PostgreSQL'e veri aktariliyor (batch execute_values)...")
    execute_values(pg_cur, "INSERT INTO leaderboard (id, username, xp) VALUES %s", users)
    pg_conn.commit()

    print("Redis'e veri aktariliyor (pipelined ZADD)...")
    pipe = r.pipeline(transaction=False)
    for uname, xp in redis_data.items():
        pipe.zadd("leaderboard_zset", {uname: xp})
    pipe.execute()

    print("\n" + "-" * 48)
    print(f"SIRALAMA PERFORMANS BENCHMARK'I ({BENCHMARK_ITERATIONS} Kosu Ortalamasi)")
    print("-" * 48)

    # 1. PostgreSQL Testi: B-Tree Index Scan
    pg_latencies = []
    for _ in range(BENCHMARK_ITERATIONS):
        t0 = time.perf_counter()
        pg_cur.execute("SELECT username, xp FROM leaderboard ORDER BY xp DESC LIMIT 50;")
        _ = pg_cur.fetchall()
        pg_latencies.append((time.perf_counter() - t0) * 1000)

    # 2. Redis Testi: In-Memory Skip List (ZREVRANGE)
    redis_latencies = []
    for _ in range(BENCHMARK_ITERATIONS):
        t1 = time.perf_counter()
        _ = r.zrevrange("leaderboard_zset", 0, 49, withscores=True)
        redis_latencies.append((time.perf_counter() - t1) * 1000)

    avg_pg = sum(pg_latencies) / len(pg_latencies)
    avg_redis = sum(redis_latencies) / len(redis_latencies)

    print(f"PostgreSQL (B-Tree Index) : {avg_pg:.2f} ms")
    print(f"Redis (ZSET Skip List)    : {avg_redis:.2f} ms")
    print(f"Performans Farki          : Redis {avg_pg / avg_redis:.1f}x daha dusuk gecikme sagladi.")
    print("-" * 48)

    pg_cur.close()
    pg_conn.close()

if __name__ == "__main__":
    main()