"""VLM (gorme) saglayici katmani. Fotograf/sayfa -> metin.

Cloud  -> Gemini (google-genai)
Ollama -> yerel gorme modeli (OpenAI-uyumlu, base64 image_url ile)
"""
import base64
import config

EXTRACT_PROMPT = (
    "Bu bir ders notu veya kitap sayfasi fotografi. Icindeki TUM metni, baslik ve "
    "madde yapisini koruyarak duz metne dok. El yazisini dikkatle coz; emin olmadigin "
    "yeri [?] ile isaretle. Yorum ekleme, sadece metni ver."
)


def image_to_text(image_bytes, mime_type="image/jpeg"):
    if config.PROVIDER == "ollama":
        return _ollama_vision(image_bytes, mime_type)
    try:
        return _gemini_vision(image_bytes, mime_type)
    except Exception as gemini_err:
        # Gemini gecici hata verirse (503 overloaded vb.) yerel Ollama vision'a dus.
        # Ollama kurulu/calisir degilse orijinal hatayi yukari tasi.
        try:
            return _ollama_vision(image_bytes, mime_type)
        except Exception:
            raise gemini_err


def _gemini_vision(image_bytes, mime_type):
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=config.GEMINI_API_KEY)
    resp = client.models.generate_content(
        model=config.VLM_MODEL,
        contents=[types.Part.from_bytes(data=image_bytes, mime_type=mime_type), EXTRACT_PROMPT],
    )
    return resp.text or ""


def _downscale_for_ollama(image_bytes, mime_type, max_edge=1400):
    """Buyuk fotolar yerel modelde cok gorsel-token uretip context'i asar
    ('exceed context size'). Uzun kenari max_edge'e kucultup token'i dusururuz.
    Zaten kucukse (veya PIL yoksa) orijinali dokunmadan dondur."""
    try:
        import io
        from PIL import Image
        img = Image.open(io.BytesIO(image_bytes))
        if max(img.size) <= max_edge:
            return image_bytes, mime_type
        img.thumbnail((max_edge, max_edge))
        buf = io.BytesIO()
        img.convert("RGB").save(buf, "JPEG", quality=85)
        return buf.getvalue(), "image/jpeg"
    except Exception:
        return image_bytes, mime_type  # kucultememezsek orijinali gonder


def _ollama_vision(image_bytes, mime_type):
    from openai import OpenAI
    client = OpenAI(base_url=config.OLLAMA_BASE_URL, api_key="ollama")
    image_bytes, mime_type = _downscale_for_ollama(image_bytes, mime_type)
    b64 = base64.b64encode(image_bytes).decode()
    resp = client.chat.completions.create(
        model=config.OLLAMA_VLM_MODEL,
        messages=[{"role": "user", "content": [
            {"type": "text", "text": EXTRACT_PROMPT},
            {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{b64}"}},
        ]}],
        # Yerel modelin varsayilan context'i (4096) OCR icin kisa kalabilir; genislet.
        extra_body={"options": {"num_ctx": 8192}},
    )
    return resp.choices[0].message.content or ""
