# ML Verifier Service - Dockerfile
# Containerized ML inference API for eco verification

FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create models directory
RUN mkdir -p ml/models

# Expose port for API
EXPOSE 8001

# Environment variables (can be overridden)
ENV PYTHONUNBUFFERED=1
ENV IPFS_API_URL=http://ipfs:5001
ENV IPFS_GATEWAY_URL=http://ipfs:8080
ENV REDIS_URL=redis://redis:6379/0

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "from ml.inference import get_verifier; get_verifier()" || exit 1

# Run the ML inference API
# Can be run as either:
# 1. API server: uvicorn app.main:app --host 0.0.0.0 --port 8001
# 2. Celery worker: celery -A backend.ml.worker worker --loglevel=info
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
