"""PDF ve Metin Ayrıştırma Modülü (PyMuPDF / fitz & pypdf fallback).

Akademik ve kurumsal ölçekte yüksek hızlı ve kayıpsız metin çıkarımı için 
PyMuPDF (fitz) birincil ayrıştırma motoru olarak yapılandırılmıştır.
Ortamda PyMuPDF bulunmadığı durumlarda ise pypdf kütüphanesine zarifçe (graceful fallback)
geri düşülür.
"""
import io
import logging

logger = logging.getLogger(__name__)


def extract_text_from_pdf(raw_bytes: bytes) -> str:
    """PDF bayt akışından sayfaları tarayarak tam metni döndürür."""
    # 1. Öncelikli Yöntem: PyMuPDF (C tabanlı, 10-20x daha hızlı)
    try:
        import pymupdf
        doc = pymupdf.open(stream=raw_bytes, filetype="pdf")
        pages_text = [page.get_text() for page in doc]
        doc.close()
        extracted = "\n".join(pages_text).strip()
        if extracted:
            return extracted
    except ImportError:
        try:
            import fitz
            doc = fitz.open(stream=raw_bytes, filetype="pdf")
            pages_text = [page.get_text() for page in doc]
            doc.close()
            extracted = "\n".join(pages_text).strip()
            if extracted:
                return extracted
        except ImportError:
            pass
    except Exception as e:
        logger.warning(f"PyMuPDF ayrıştırma uyarısı: {e}. pypdf fallback devrede.")

    # 2. İkincil Güvence: pypdf Fallback
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(raw_bytes))
        pages_text = [(page.extract_text() or "") for page in reader.pages]
        return "\n".join(pages_text).strip()
    except Exception as e:
        logger.error(f"PDF metin çıkarımı başarısız oldu: {e}")
        return ""


def extract_text(filename: str, raw_bytes: bytes) -> str:
    """Dosya uzantısına göre uygun ayrıştırıcıyı çağırır."""
    if filename.lower().endswith(".pdf"):
        return extract_text_from_pdf(raw_bytes)
    return raw_bytes.decode("utf-8", errors="ignore")
