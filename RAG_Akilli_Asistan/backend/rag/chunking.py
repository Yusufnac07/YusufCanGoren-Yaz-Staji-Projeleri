"""Chunking. smart_chunks: paragraf/cumle sinirlarini korur, overlap uygular."""
import re
import config


def _paragraphs(text):
    return [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]


def _sentences(text):
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]


def smart_chunks(text, size=config.CHUNK_SIZE, overlap=config.CHUNK_OVERLAP):
    units = []
    for para in _paragraphs(text):
        units.append(para) if len(para) <= size else units.extend(_sentences(para))
    chunks, buf = [], ""
    for u in units:
        if buf and len(buf) + len(u) + 1 > size:
            chunks.append(buf.strip())
            buf = ((buf[-overlap:] if overlap else "") + " " + u).strip()
        else:
            buf = (buf + " " + u).strip() if buf else u
    if buf.strip():
        chunks.append(buf.strip())
    return [c for c in chunks if c]
