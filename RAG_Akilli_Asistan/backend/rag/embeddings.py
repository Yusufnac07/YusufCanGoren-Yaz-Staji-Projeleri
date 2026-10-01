"""Local embedding (sentence-transformers). HER IKI MODDA DA AYNI - hep yerel, ucretsiz, gizli."""
from sentence_transformers import SentenceTransformer
import config

_model = None


def _get():
    global _model
    if _model is None:
        _model = SentenceTransformer(config.EMBEDDING_MODEL)
    return _model


def embed(texts):
    return _get().encode(texts, normalize_embeddings=True).tolist()
