"""Merkezi konfigurasyon. Tek anahtar (PROVIDER) ile bulut/yerel arasinda gecis."""
import os
from dotenv import load_dotenv

load_dotenv()

# ==== SAGLAYICI SECIMI ====
# "cloud"  -> LLM: Groq,   VLM: Gemini   (internet gerekir)
# "ollama" -> LLM: Ollama, VLM: Ollama   (tamamen yerel, internet gerekmez)
PROVIDER = os.environ.get("PROVIDER", "cloud")

# ---- CLOUD (Groq + Gemini) ----
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GROQ_BASE_URL = "https://api.groq.com/openai/v1"
LLM_MODEL = os.environ.get("LLM_MODEL", "llama-3.3-70b-versatile")
VLM_MODEL = os.environ.get("VLM_MODEL", "gemini-3.5-flash")

# ---- OLLAMA (yerel) ----
# Onceden indir:  ollama pull llama3.1:8b   &&   ollama pull qwen2.5vl:7b
# Not: llama3.2-vision (mllama mimarisi) yeni Ollama surumlerinde yuklenemiyor
# ("unknown model architecture: 'mllama'"); OCR icin qwen2.5vl kullaniyoruz.
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434/v1")
OLLAMA_LLM_MODEL = os.environ.get("OLLAMA_LLM_MODEL", "llama3.1:8b")       # tool+JSON destekli
OLLAMA_VLM_MODEL = os.environ.get("OLLAMA_VLM_MODEL", "qwen2.5vl:7b")      # gorme (OCR)

# ---- RAG (her iki modda da AYNI, tamamen yerel) ----
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
CHROMA_DIR = os.environ.get("CHROMA_DIR", "chroma_db")
CHUNK_SIZE = 800
CHUNK_OVERLAP = 120
TOP_K = 6
# Ilgisiz kaynaklari elemek icin mesafe esigi (Chroma L2-kare, normalize embedding -> 0..4 arasi).
# Buyuk deger = daha genis tolerans. En iyi eslesme her zaman tutulur (bkz. rag/store.py).
RELEVANCE_MAX_DISTANCE = float(os.environ.get("RELEVANCE_MAX_DISTANCE", "1.5"))

# Not: Prompt'lar bilerek duzgun Turkce karakterlerle yazildi — model cikti stilini
# prompt'tan kopyalar; ASCII'lestirilmis prompt ASCII'lestirilmis cevap uretiyordu.
SYSTEM_PROMPT = (
    "Sen bir çalışma asistanısın. Sana KAYNAKLAR verildiğinde SADECE o kaynaklara "
    "dayanarak cevap ver. Kaynakta cevap yoksa 'Bu materyalde bulamadım' de; ASLA uydurma. "
    "Kullandığın her kaynağı [kaynak N] biçiminde belirt. "
    "Düzgün Türkçe yaz; Türkçe karakterleri (ç, ğ, ı, ö, ş, ü) doğru kullan."
)

# Materyal baglami OLMADAN yapilan genel sohbet icin (kaynak sarti yok).
GENERAL_PROMPT = (
    "Sen yardımcı bir çalışma asistanısın. Genel bilginle açık, doğru ve özlü cevaplar ver. "
    "Düzgün Türkçe yaz; Türkçe karakterleri (ç, ğ, ı, ö, ş, ü) doğru kullan."
)


def active():
    """Aktif saglayicinin ozeti (health/log icin)."""
    if PROVIDER == "ollama":
        return {"provider": "ollama", "llm": OLLAMA_LLM_MODEL,
                "vlm": OLLAMA_VLM_MODEL, "base": OLLAMA_BASE_URL}
    return {"provider": "cloud", "llm": LLM_MODEL, "vlm": VLM_MODEL, "base": GROQ_BASE_URL}
