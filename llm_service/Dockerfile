# Dockerfile optimizado para resolver problemas de dependencias
FROM python:3.9-slim

# Establecer directorio de trabajo
WORKDIR /app

# Instalar librerías del sistema necesarias y limpiar para reducir tamaño
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copiar solo el archivo de requisitos primero
COPY ./app/requirements.txt .

# Actualizar pip e instalar las dependencias con estrategia para evitar conflictos
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -U setuptools wheel && \
    # Instalar primero las dependencias principales para controlar resolución
    pip install --no-cache-dir pydantic==1.10.12 && \
    pip install --no-cache-dir fastapi==0.103.1 uvicorn==0.23.2 && \
    pip install --no-cache-dir pymongo==4.5.0 && \
    # Instalar langchain primero, permitiendo que se instale la versión correcta de langchain-core
    pip install --no-cache-dir langchain==0.1.9 && \
    # Filtrar langchain-core del requirements.txt para evitar conflictos
    grep -v "langchain-core==0.1.18" requirements.txt > requirements_filtered.txt && \
    pip install --no-cache-dir -r requirements_filtered.txt

# Copiar el resto del código de la aplicación
COPY ./app .

# Adaptar el código si es necesario para la versión actualizada de langchain
RUN if [ -f rag_service.py.bak ]; then rm rag_service.py.bak; fi && \
    cp rag_service.py rag_service.py.bak && \
    sed -i 's/from langchain.prompts import PromptTemplate/from langchain_core.prompts import PromptTemplate/g' rag_service.py && \
    sed -i 's/from langchain.chains import LLMChain/from langchain.chains.llm import LLMChain/g' rag_service.py

# Exponer el puerto para la API
EXPOSE 8000

# Crear usuario no-root por seguridad
RUN useradd -m appuser
USER appuser

# Comando para iniciar la aplicación con 4 workers
CMD ["uvicorn", "rag_service:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]