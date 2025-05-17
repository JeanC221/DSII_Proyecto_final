#!/bin/bash
# setup.sh - Script para configurar el entorno de desarrollo

# Colores para mensajes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Iniciando configuración del entorno de desarrollo...${NC}"

# Verificar que Docker esté instalado
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker no está instalado. Por favor, instale Docker antes de continuar.${NC}"
    echo "Visite https://docs.docker.com/get-docker/ para instrucciones de instalación."
    exit 1
fi

# Verificar que Docker Compose esté instalado
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Docker Compose no está instalado. Por favor, instale Docker Compose antes de continuar.${NC}"
    echo "Visite https://docs.docker.com/compose/install/ para instrucciones de instalación."
    exit 1
fi

echo -e "${GREEN}✓ Docker y Docker Compose están instalados.${NC}"

# Crear directorios necesarios
echo "Creando directorios necesarios..."
mkdir -p backend/src/credentials

# Verificar si existe el archivo de credenciales de Firebase
if [ ! -f backend/src/credentials/firebase-credentials.json ]; then
    echo -e "${YELLOW}⚠ No se encontró el archivo de credenciales de Firebase.${NC}"
    echo "Por favor, descargue sus credenciales desde la consola de Firebase y guárdelas en:"
    echo "backend/src/credentials/firebase-credentials.json"
fi

# Verificar si existe el archivo .env
if [ ! -f .env ]; then
    echo "Creando archivo .env con valores por defecto..."
    cat > .env << EOL
# Configuración de Firebase
FIREBASE_PROJECT_ID=tu-proyecto-id

# Configuración del servicio LLM
HUGGINGFACEHUB_API_TOKEN=hf_dummy_token

# Configuración de puertos (opcional)
FRONTEND_PORT=3000
BACKEND_PORT=5000
LLM_SERVICE_PORT=8000
MONGODB_PORT=27017
EOL
    echo -e "${YELLOW}⚠ Se ha creado un archivo .env con valores por defecto. Por favor, actualícelo con sus propios valores.${NC}"
fi

echo "¿Desea instalar las dependencias de desarrollo para Node.js? (s/n)"
read response
if [[ "$response" =~ ^([sS]|[sS][iI])$ ]]; then
    echo "Instalando dependencias de Node.js..."
    # Backend
    cd backend && npm install && cd ..
    # Frontend
    cd frontend && npm install && cd ..
    echo -e "${GREEN}✓ Dependencias de Node.js instaladas correctamente.${NC}"
fi

# Crear entorno virtual de Python para desarrollo local (opcional)
echo "¿Desea crear un entorno virtual de Python para desarrollo local? (s/n)"
read response
if [[ "$response" =~ ^([sS]|[sS][iI])$ ]]; then
    echo "Creando entorno virtual de Python..."
    cd llm_service
    if command -v python3 &> /dev/null; then
        python3 -m venv venv
        source venv/bin/activate
        pip install --upgrade pip
        pip install -r app/requirements.txt
        deactivate
        echo -e "${GREEN}✓ Entorno virtual de Python creado correctamente.${NC}"
    else
        echo -e "${RED}Python 3 no está instalado. No se pudo crear el entorno virtual.${NC}"
    fi
    cd ..
fi

echo -e "${GREEN}¡Configuración completada!${NC}"
echo -e "Para iniciar la aplicación, ejecute: ${YELLOW}docker-compose up${NC}"
echo -e "Para acceder a la aplicación, visite: ${YELLOW}http://localhost:3000${NC}"