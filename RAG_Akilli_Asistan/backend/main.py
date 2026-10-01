import json
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import config
from pdf_parser import extract_text
from llm import chat_stream
from structured import structured_answer
from rag.chunking import smart_chunks
from rag.store import add_documents, reset, list_sources
from rag.retriever import build_context
from vlm import image_to_text
from agent import run_agent, tool_make_quiz, tool_grade_answer

app = FastAPI(title="Calisma Asistani API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

NO_MATERIAL_MSG = "Yuklu materyal bulunamadi. Lutfen once dokuman veya gorsel ekleyiniz."


class ChatIn(BaseModel):
    message: str


class StreamIn(BaseModel):
    message: str
    use_context: bool = False


class QuizIn(BaseModel):
    konu: str = ""
    adet: int = 3


class GradeIn(BaseModel):
    soru: str
    cevap: str


class ProviderIn(BaseModel):
    provider: str  # 'cloud' | 'ollama'


@app.get("/health")
def health():
    return {"status": "ok", **config.active()}


@app.post("/chat")
def chat_endpoint(body: ChatIn):
    return structured_answer(body.message)


@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    raw = await file.read()
    text = extract_text(file.filename, raw)
    chunks = smart_chunks(text)
    n = add_documents(chunks, source_name=file.filename)
    return {"indexed_chunks": n, "source": file.filename, "chars": len(text)}


@app.post("/ask")
def ask(body: ChatIn):
    context, hits = build_context(body.message)
    if not context:
        return {"answer": {"cevap": NO_MATERIAL_MSG, "guven": 1.0, "kaynaklar": []}, "sources": []}
    answer = structured_answer(body.message, context=context)
    sources = [{"n": i + 1, "source": m["source"], "chunk": m["chunk"]} for i, (_, m) in enumerate(hits)]
    return {"answer": answer, "sources": sources}


@app.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):
    raw = await file.read()
    try:
        text = image_to_text(raw, mime_type=file.content_type or "image/jpeg")
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Gorsel islenemedi: {type(e).__name__}. VLM servisini kontrol ediniz."
        )
    snippet = " ".join(text.split())[:40].strip()
    source = f"gorsel_{file.filename}" if not snippet else f"not_{snippet}..."
    n = add_documents(smart_chunks(text), source_name=source)
    return {"extracted_chars": len(text), "indexed_chunks": n, "preview": text[:400], "source": source}


@app.post("/agent")
def agent_endpoint(body: ChatIn):
    return {"answer": run_agent(body.message)}


@app.post("/chat-stream")
def chat_stream_endpoint(body: StreamIn):
    sources = []
    user_prompt = body.message
    system_prompt = config.GENERAL_PROMPT

    if body.use_context:
        context, hits = build_context(body.message)
        if not context:
            def gen_empty():
                yield json.dumps({"sources": []}, ensure_ascii=False) + "\n"
                yield NO_MATERIAL_MSG
            return StreamingResponse(gen_empty(), media_type="text/plain; charset=utf-8")
        
        sources = [{"n": i + 1, "source": m["source"], "chunk": m["chunk"]} for i, (_, m) in enumerate(hits)]
        user_prompt = f"KAYNAKLAR:\n{context}\n\nSORU: {body.message}"
        system_prompt = config.SYSTEM_PROMPT

    def gen():
        yield json.dumps({"sources": sources}, ensure_ascii=False) + "\n"
        for token in chat_stream([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]):
            yield token

    return StreamingResponse(gen(), media_type="text/plain; charset=utf-8")


@app.get("/materials")
def materials():
    return {"materials": list_sources()}


@app.post("/quiz")
def quiz(body: QuizIn):
    raw = tool_make_quiz(body.konu or "genel", max(1, min(body.adet, 10)))
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"sorular": [], "not": "Quiz olusturulamadi."}


@app.post("/grade")
def grade(body: GradeIn):
    raw = tool_grade_answer(body.soru, body.cevap)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"puan": None, "geri_bildirim": raw}


@app.post("/provider")
def set_provider(body: ProviderIn):
    if body.provider not in ("cloud", "ollama"):
        raise HTTPException(status_code=400, detail="provider 'cloud' veya 'ollama' olmalidir")
    config.PROVIDER = body.provider
    return {"status": "ok", **config.active()}


@app.post("/reset")
def reset_endpoint():
    reset()
    return {"status": "reset"}
