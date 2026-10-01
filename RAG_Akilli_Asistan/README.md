# Cok Modlu RAG Calisma Asistani

Bu proje; PDF belgeleri, metin dosyalari ve el yazisi not fotograflari uzerinden baglam odakli soru-cevap, otomatik quiz uretimi ve ogrenci yaniti degerlendirmesi yapan cok modlu (multimodal) bir RAG sistemidir.

---

## 1. Mimari

```
[Istemci: Web / React Native]
            │
            ▼ (HTTP / SSE Akisi)
[FastAPI REST Servisi]
   ├── Metin Cikarimi: PyMuPDF (fitz) + pypdf fallback (pdf_parser.py)
   ├── Gorme Katmani (OCR): Gemini Flash / Qwen2.5-VL (vlm.py)
   ├── Parcalama: Cumle/Paragraf sinirli ortusmeli chunking (chunking.py)
   ├── Vektor Temsili: all-MiniLM-L6-v2 (384-d, normalize L2)
   ├── Vektor Deposu: ChromaDB PersistentClient (store.py)
   └── Uretim: Groq Llama-3.3-70B / Ollama Llama-3.1-8B (llm.py, agent.py)
```

### Teknik Ozellikler
- **Cift Model Destegi:** `config.py` icindeki `PROVIDER` parametresi ile sistem tek satir konfigurasyonla API tabanli bulut modunda (`cloud`) veya tamamen internet bagimsiz yerel modda (`ollama`) calisabilir.
- **Hizli Metin Cikarimi:** PDF ayrıştırmada C tabanli PyMuPDF kutuphanesi onceliklidir. Kutuk kutuphane ortamda bulunamadiginda sistem otomatik olarak `pypdf`'e geri duser.
- **Mesafe Esigi ve Halusinasyon Kontrolu:** ChromaDB sorgularinda L2 mesafe esigi (`RELEVANCE_MAX_DISTANCE = 1.5`) uygulanir. Esik degeri asan alakasiz parcalar LLM context'ine dahil edilmez.
- **Token Akisi (Streaming):** `/chat-stream` uzerinden yanitlar parca parca (chunked streaming) iletilir.

---

## 2. Dizin Yapisi

```
RAG_Akilli_Asistan/
├── backend/
│   ├── rag/
│   │   ├── chunking.py       # Paragraf ve cumle bolucu
│   │   ├── embeddings.py     # SentenceTransformers yoneticisi
│   │   ├── retriever.py      # Baglam olusturucu
│   │   └── store.py          # ChromaDB CRUD islemleri
│   ├── agent.py              # Quiz ve notlandirma fonksiyon cagrilarini yoneten ajan
│   ├── config.py             # Model ve servis ayarlari
│   ├── llm.py                # OpenAI uyumlu LLM istemcisi
│   ├── pdf_parser.py         # PyMuPDF ve pypdf metin cikarici
│   ├── structured.py         # JSON formatli cikti motoru
│   ├── vlm.py                # Gorme ve OCR modeli
│   ├── main.py               # FastAPI endpoint tanimlari
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── App.js                # Mobil uygulama kok bileseni (Expo)
│   ├── index.html            # Hizli tarayici test konsolu
│   ├── package.json
│   └── src/
│       ├── api.js            # Backend istek katmani
│       ├── components.js     # UI bilesenleri
│       ├── storage.js        # Oturum depolama
│       └── screens/          # Uygulama ekranlari
├── ornek_girdiler/           # Test dokumanlari (PDF ve TXT)
└── docker-compose.yml
```

---

## 3. Kurulum ve Calistirma

### Yerel Ortam

```bash
cd backend
python -m venv venv

# Windows:
.\venv\Scripts\activate
# Linux/macOS:
# source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
```

`.env` dosyasina API anahtarlarinizi tanimlayin, ardindan sunucuyu baslatin:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- **Arayuz:** Tarayicida `frontend/index.html` dosyasini acarak sistemi `http://localhost:8000` uzerinden dogrudan test edebilirsiniz.
- **Swagger Dokumantasyonu:** `http://localhost:8000/docs`

### Docker ile Calistirma

```bash
docker compose up -d rag-backend
```

---

## 4. API Endpoint Ozeti

| Metot | Yol | Aciklama |
|---|---|---|
| `GET` | `/health` | Saglayici durumu ve aktif model bilgisi |
| `POST` | `/upload` | PDF/TXT dokumani yukleme ve ChromaDB'ye indeksleme |
| `POST` | `/chat-stream` | Materyal baglamli SSE token akisi |
| `POST` | `/ask` | JSON formatinda kaynakli yapisal cevap |
| `POST` | `/upload-image` | Not gorselini OCR ile metne dokup indeksleme |
| `POST` | `/quiz` | Materyale dayali soru-cevap seti olusturma |
| `POST` | `/grade` | Ogrenci cevabini materyale gore 0-100 arasi puanlama |
| `GET` | `/materials` | Indekslenen dokumanlar ve parca sayilari |
| `POST` | `/reset` | Vektor deposunu sifirlama |
