# Backend'i canliya cikarmak icin. NOT: Ollama modunda backend'in erisebildigi bir
# Ollama sunucusu gerekir (Mac'te Ollama'yi NATIVE calistir, Docker'da degil - GPU/Metal icin).
FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
ENV CHROMA_DIR=/app/chroma_db
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
