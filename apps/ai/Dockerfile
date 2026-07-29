FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app
COPY apps/ai/requirements.txt .
RUN pip install \
    --no-cache-dir \
    --retries 10 \
    --timeout 60 \
    --requirement requirements.txt
COPY apps/ai/app app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
