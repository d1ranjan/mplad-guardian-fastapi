FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip python3-venv ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
RUN npm install -g corepack@latest \
    && corepack pnpm install \
    && corepack pnpm run build \
    && python3 -m pip install --break-system-packages --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu -r backend/requirements.txt
ENV NODE_ENV=production \
    PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["sh", "-c", "cd /app/backend && alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
