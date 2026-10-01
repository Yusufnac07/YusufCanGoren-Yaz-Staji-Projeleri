"""Agent + tool calling. Provider-agnostik (chat() uzerinden). max_steps ile loop/maliyet korunur.
Not: Ollama modunda tool-calling icin tool destekli model gerekir (llama3.1, qwen2.5)."""
import json
from llm import chat
from rag.retriever import build_context
from structured import structured_answer


def tool_answer_from_material(soru):
    context, _ = build_context(soru)
    if not context:
        return "Materyalde ilgili bilgi bulunamadi."
    ans = structured_answer(soru, context=context)
    return ans.get("cevap", "") if isinstance(ans, dict) else str(ans)


# Not: prompt'lar bilerek duzgun Turkce karakterle yazildi — model cikti stilini
# prompt'tan kopyalar; ASCII'lestirilmis prompt Turkce karaktersiz soru uretiyordu.
def tool_make_quiz(konu, adet=3):
    context, _ = build_context(konu)
    if not context:
        return json.dumps({"sorular": [], "not": "Materyal bulunamadi."}, ensure_ascii=False)
    prompt = (f"Aşağıdaki materyalden {adet} adet kısa cevaplı soru üret. "
              "Soruları ve cevapları düzgün Türkçe yaz; Türkçe karakterleri (ç, ğ, ı, ö, ş, ü) doğru kullan. "
              'SADECE şu JSON: {"sorular":[{"soru":str,"cevap":str}]}.\n\nMATERYAL:\n' + context)
    return chat([{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}).choices[0].message.content or "{}"


def tool_grade_answer(soru, ogrenci_cevabi):
    context, _ = build_context(soru)
    prompt = (f"Soru: {soru}\nÖğrenci cevabı: {ogrenci_cevabi}\nMATERYAL:\n{context}\n\n"
              "Öğrencinin cevabını materyale göre değerlendir. Geri bildirimi düzgün Türkçe yaz; "
              "Türkçe karakterleri (ç, ğ, ı, ö, ş, ü) doğru kullan. SADECE şu JSON: "
              '{"puan": int(0-100), "geri_bildirim": str}.')
    return chat([{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}).choices[0].message.content or "{}"


TOOLS = [
    {"type": "function", "function": {
        "name": "materyalden_cevapla",
        "description": "Kullanicinin yukledigi materyalden bir soruyu kaynak gostererek cevaplar.",
        "parameters": {"type": "object", "properties": {"soru": {"type": "string"}}, "required": ["soru"]}}},
    {"type": "function", "function": {
        "name": "quiz_uret",
        "description": "Materyalden sinav sorulari uretir (beni sina).",
        "parameters": {"type": "object", "properties": {
            "konu": {"type": "string"}, "adet": {"type": "integer"}}, "required": ["konu"]}}},
    {"type": "function", "function": {
        "name": "cevabi_degerlendir",
        "description": "Ogrencinin bir soruya verdigi cevabi materyale gore puanlar.",
        "parameters": {"type": "object", "properties": {
            "soru": {"type": "string"}, "ogrenci_cevabi": {"type": "string"}},
            "required": ["soru", "ogrenci_cevabi"]}}},
]

_DISPATCH = {
    "materyalden_cevapla": lambda a: tool_answer_from_material(a.get("soru", "")),
    "quiz_uret": lambda a: tool_make_quiz(a.get("konu", ""), a.get("adet", 3)),
    "cevabi_degerlendir": lambda a: tool_grade_answer(a.get("soru", ""), a.get("ogrenci_cevabi", "")),
}


def run_agent(user_text, max_steps=4):
    messages = [
        {"role": "system", "content": "Sen bir calisma asistanisin. Gerektiginde araclari kullan. "
                                      "Cevabi materyalden ver, bilmiyorsan uydurma."},
        {"role": "user", "content": user_text},
    ]
    for _ in range(max_steps):
        msg = chat(messages, tools=TOOLS, tool_choice="auto").choices[0].message
        if not msg.tool_calls:
            return msg.content or ""
        messages.append({
            "role": "assistant", "content": msg.content or "",
            "tool_calls": [{"id": tc.id, "type": "function",
                            "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                           for tc in msg.tool_calls],
        })
        for tc in msg.tool_calls:
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            result = _DISPATCH.get(tc.function.name, lambda a: "Bilinmeyen arac")(args)
            messages.append({"role": "tool", "tool_call_id": tc.id, "content": str(result)})
    return chat(messages).choices[0].message.content or ""
