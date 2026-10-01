"""Retrieve + citation. Numaralandirilmis kaynak context'i uretir."""
from rag.store import query


def build_context(question):
    hits = query(question)
    blocks = [f"[kaynak {n}] ({m['source']}#{m['chunk']})\n{d}"
              for n, (d, m) in enumerate(hits, start=1)]
    return "\n\n".join(blocks), hits
