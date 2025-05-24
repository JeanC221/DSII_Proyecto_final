@echo off
REM setup-mongodb.bat - Script para configurar MongoDB en Windows

echo.
echo 📦 Configurando MongoDB para el sistema de logs...
echo.

REM Verificar Docker
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker no está instalado o no está en PATH
    echo Instala Docker Desktop desde: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker Compose no está disponible
    echo Instala Docker Desktop que incluye Docker Compose
    pause
    exit /b 1
)

echo ✅ Docker y Docker Compose detectados
echo.

REM Crear directorios necesarios
echo 📁 Creando directorios...
if not exist "logs\mongodb" mkdir logs\mongodb
echo ✅ Directorio logs\mongodb creado
echo.

REM Cambiar al directorio backend
echo 📦 Actualizando dependencias del backend...
cd backend

REM Verificar si MongoDB ya está en package.json
findstr /c:"mongodb" package.json >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ MongoDB ya está en las dependencias
) else (
    echo ➕ Agregando MongoDB a package.json...
    copy package.json package.json.backup
    npm install mongodb@^6.3.0
    if %errorlevel% neq 0 (
        echo ❌ Error instalando MongoDB. Verifica tu conexión a internet.
        pause
        exit /b 1
    )
    echo ✅ MongoDB agregado a las dependencias
)

cd ..

REM Crear script de prueba de MongoDB
echo 🧪 Creando script de prueba...
(
echo const { MongoClient } = require('mongodb'^);
echo.
echo async function testMongoDB(^) {
echo   const url = 'mongodb://localhost:27017';
echo   const client = new MongoClient(url^);
echo.  
echo   try {
echo     await client.connect(^);
echo     console.log('✅ Conexión a MongoDB exitosa'^);
echo.    
echo     const db = client.db('logs_db'^);
echo     const collection = db.collection('test_logs'^);
echo.    
echo     const testDoc = {
echo       accion: 'Prueba MongoDB',
echo       detalles: 'Configuración inicial del sistema',
echo       timestamp: new Date(^),
echo       categoria: 'sistema'
echo     };
echo.    
echo     await collection.insertOne(testDoc^);
echo     console.log('✅ Documento de prueba insertado'^);
echo.    
echo     const docs = await collection.find({}).toArray(^);
echo     console.log(`✅ Documentos encontrados: ${docs.length}`^);
echo.    
echo     await collection.deleteMany({});
echo     console.log('✅ Documentos de prueba eliminados'^);
echo.    
echo   } catch (error^) {
echo     console.error('❌ Error:', error.message^);
echo   } finally {
echo     await client.close(^);
echo   }
echo }
echo.
echo testMongoDB(^);
) > test-mongodb.js

echo ✅ Script de prueba creado: test-mongodb.js
echo.

REM Verificar archivos necesarios
echo 📋 Verificando estructura del proyecto...
set FILES=backend\src\config\mongoConfig.js backend\src\utils\logger.js backend\src\routes\health.js backend\src\routes\logs.js backend\src\index.js

for %%f in (%FILES%) do (
    if exist "%%f" (
        echo ✅ %%f
    ) else (
        echo ❌ %%f - FALTA CREAR
    )
)

echo.
echo 🚀 Próximos pasos:
echo.
echo 1. Copia la configuración de MongoDB mostrada en el chat al docker-compose.yml
echo 2. Ejecuta: docker-compose down
echo 3. Ejecuta: docker-compose up --build -d
echo 4. Espera que todos los contenedores estén running
echo 5. Prueba: node test-mongodb.js
echo.
echo ✅ Configuración de MongoDB completada
echo.
pause