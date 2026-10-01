"""Chroma vector store (kalici, yerel, ucretsiz). HER IKI MODDA DA AYNI."""
import chromadb
import config
from rag.embeddings import embed

_client = chromadb.PersistentClient(path=config.CHROMA_DIR)


def get_collection(name="materyal"):
    return _client.get_or_create_collection(name)


def add_documents(chunks, source_name, collection="materyal"):
    if not chunks:
        return 0
    col = get_collection(collection)
    offset = col.count()
    ids = [f"{source_name}-{offset + i}" for i in range(len(chunks))]
    metas = [{"source": source_name, "chunk": i} for i in range(len(chunks))]
    col.add(ids=ids, documents=chunks, embeddings=embed(chunks), metadatas=metas)
    return len(chunks)


def query(question, top_k=config.TOP_K, collection="materyal"):
    col = get_collection(collection)
    total = col.count()
    if total == 0:
        return []
    res = col.query(query_embeddings=embed([question]),
                    n_results=min(top_k, total),
                    include=["documents", "metadatas", "distances"])
    hits = list(zip(res["documents"][0], res["metadatas"][0], res["distances"][0]))
    # Ilgisiz kuyrugu ele: esigi asan parcalar dusurulur, en iyi eslesme hep tutulur
    # (soru gercekten materyal disiysa LLM zaten 'bulamadim' der).
    kept = [(d, m) for d, m, dist in hits if dist <= config.RELEVANCE_MAX_DISTANCE]
    if not kept and hits:
        kept = [(hits[0][0], hits[0][1])]
    return kept


def list_sources(collection="materyal"):
    """Yuklu materyalleri kaynak bazinda ozetler: [{source, chunks}]."""
    col = get_collection(collection)
    if col.count() == 0:
        return []
    res = col.get(include=["metadatas"])
    counts = {}
    for m in res["metadatas"]:
        counts[m["source"]] = counts.get(m["source"], 0) + 1
    return [{"source": src, "chunks": n} for src, n in sorted(counts.items())]


def reset(collection="materyal"):
    try:
        _client.delete_collection(collection)
    except Exception:
        pass
