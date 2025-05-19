FROM python:3.9-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY ./app/requirements.txt .

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -U setuptools wheel && \
    pip install --no-cache-dir pydantic==1.10.12 && \
    pip install --no-cache-dir fastapi==0.103.1 uvicorn==0.23.2 && \
    pip install --no-cache-dir pymongo==4.5.0 && \
    pip install --no-cache-dir langchain==0.1.9 && \
    grep -v "langchain-core==0.1.18" requirements.txt > requirements_filtered.txt && \
    pip install --no-cache-dir -r requirements_filtered.txt

COPY ./app .

RUN if [ -f rag_service.py.bak ]; then rm rag_service.py.bak; fi && \
    cp rag_service.py rag_service.py.bak && \
    sed -i 's/from langchain.prompts import PromptTemplate/from langchain_core.prompts import PromptTemplate/g' rag_service.py && \
    sed -i 's/from langchain.chains import LLMChain/from langchain.chains.llm import LLMChain/g' rag_service.py

EXPOSE 8000

RUN useradd -m appuser
USER appuser

CMD ["uvicorn", "rag_service:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]