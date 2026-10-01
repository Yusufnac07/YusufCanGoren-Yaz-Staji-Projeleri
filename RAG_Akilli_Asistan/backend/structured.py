"""Yapisal (JSON) cikti. Her iki saglayicida da JSON modu ile calisir.
Not: yerel (Ollama) modelde JSON/tool guvenilirligi modele baglidir; llama3.1/qwen2.5 onerilir."""
import json
import config
from llm import chat

_SCHEMA = ' Cevabini SADECE su JSON ile ver: {"cevap": string, "guven": number(0-1), "kaynaklar": array(int)}.'


def structured_answer(question, context=""):
    # Context varsa kaynak-zorunlu prompt; yoksa genel sohbet prompt'u
    # (aksi halde genel sorulara da "Bu materyalde bulamadım" diyordu).
    base = config.SYSTEM_PROMPT if context else config.GENERAL_PROMPT
    system = base + _SCHEMA
    user = question if not context else f"KAYNAKLAR:\n{context}\n\nSORU: {question}"
    r = chat(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        response_format={"type": "json_object"},
    )
    raw = r.choices[0].message.content or ""
    try:
        data = json.loads(raw)
        data.setdefault("cevap", "")
        data.setdefault("guven", None)
        data.setdefault("kaynaklar", [])
        return data
    except json.JSONDecodeError:
        return {"cevap": raw, "guven": None, "kaynaklar": []}
