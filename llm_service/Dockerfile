FROM python:3.9
WORKDIR /app
COPY ./app/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY ./app .
CMD ["uvicorn", "rag_service:app", "--host", "0.0.0.0", "--port", "8000"]
