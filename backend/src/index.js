const express = require("express");
const personasRouter = require("./routes/personas");
const logsRouter = require("./routes/logs");
const consultaNaturalRouter = require("./routes/consultaNatural");
const healthRouter = require("./routes/health");
const cors = require("cors");
const { db } = require("./config/firebaseConfig");
const { mongoManager } = require("./config/mongoConfig");
const { Timestamp } = require('firebase-admin/firestore');

const app = express();
const PORT = process.env.PORT || 5000;

// Configuración CORS
app.use(cors({
  origin: ['http://localhost:3000', 'http://frontend', 'http://localhost'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Inicializar conexión MongoDB al arrancar
async function initializeServices() {
  console.log('🚀 Inicializando servicios...');
  
  try {
    // Intentar conectar MongoDB (no crítico)
    await mongoManager.connect();
    console.log('✅ MongoDB: Servicio de logs inicializado');
  } catch (error) {
    console.warn('⚠️ MongoDB: No disponible, usando solo Firebase para logs');
    console.warn('   Esto no afecta la funcionalidad principal del sistema');
  }
  
  console.log('✅ Firebase: Sistema principal operativo');
  console.log('🎯 Todos los servicios core inicializados correctamente');
}

// Rutas principales
app.use("/api/personas", personasRouter);
app.use("/api/logs", logsRouter);
app.use("/api/consulta-natural", consultaNaturalRouter);
app.use("/api/health", healthRouter);

// Endpoint adicional para estadísticas de sistema
app.get("/api/system/status", async (req, res) => {
  try {
    const status = {
      timestamp: new Date().toISOString(),
      services: {
        firebase: {
          status: "operational",
          description: "Sistema principal de datos"
        },
        mongodb: {
          status: await mongoManager.isHealthy() ? "operational" : "unavailable",
          description: "Sistema de logs y auditoría"
        },
        api: {
          status: "operational",
          port: PORT,
          description: "API REST backend"
        }
      },
      database_strategy: {
        personas: "Firebase Firestore",
        logs: await mongoManager.isHealthy() ? "MongoDB + Firebase (híbrido)" : "Firebase (fallback)",
        description: "Arquitectura híbrida para máxima disponibilidad"
      }
    };
    
    res.json(status);
  } catch (error) {
    console.error('Error en status del sistema:', error);
    res.status(500).json({ 
      error: "Error obteniendo status del sistema",
      timestamp: new Date().toISOString()
    });
  }
});

// Middleware de manejo de errores
app.use((err, req, res, next) => {
  console.error('❌ Error del servidor:', err.stack);
  res.status(500).json({ 
    error: "Error interno del servidor",
    timestamp: new Date().toISOString(),
    request_id: req.headers['x-request-id'] || 'unknown'
  });
});

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
  console.log(`❌ Ruta no encontrada: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: "Ruta no encontrada",
    path: req.originalUrl,
    method: req.method,
    available_endpoints: [
      "GET  /api/health - Health check del sistema",
      "GET  /api/system/status - Estado de todos los servicios",
      "POST /api/consulta-natural - Consultas en lenguaje natural",
      "CRUD /api/personas - Gestión de personas",
      "GET  /api/logs - Consulta de logs del sistema"
    ]
  });
});

// Manejo graceful del cierre del servidor
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM recibido, cerrando servidor gracefully...');
  
  try {
    await mongoManager.disconnect();
    console.log('✅ MongoDB: Conexión cerrada correctamente');
  } catch (error) {
    console.warn('⚠️ Error cerrando MongoDB:', error.message);
  }
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT recibido, cerrando servidor...');
  
  try {
    await mongoManager.disconnect();
    console.log('✅ MongoDB: Conexión cerrada correctamente');
  } catch (error) {
    console.warn('⚠️ Error cerrando MongoDB:', error.message);
  }
  
  process.exit(0);
});

// Inicializar servicios y arrancar servidor
initializeServices().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Backend running on port ${PORT}`);
    console.log(`🔗 LLM Service URL: ${process.env.LLM_SERVICE_URL || "http://rag_service:8000"}`);
    console.log(`🔗 MongoDB URL: ${process.env.MONGODB_URL || "mongodb://mongodb:27017/logs_db"}`);
    console.log(`📋 Endpoints disponibles:`);
    console.log(`   GET  /api/health - Backend health check`);
    console.log(`   GET  /api/health/rag - RAG service health check`);
    console.log(`   GET  /api/system/status - Estado completo del sistema`);
    console.log(`   POST /api/consulta-natural - Natural language queries`);
    console.log(`   CRUD /api/personas - Person management`);
    console.log(`   GET  /api/logs - Activity logs`);
    console.log(`📊 Arquitectura: Firebase (principal) + MongoDB (logs)`);
  });
}).catch(error => {
  console.error('💥 Error crítico al inicializar servicios:', error);
  console.error('🔄 El servidor continuará solo con Firebase...');
  
  // Arrancar servidor sin MongoDB como fallback
  app.listen(PORT, () => {
    console.log(`🚀 Backend running on port ${PORT} (modo fallback)`);
    console.log(`⚠️ Sistema operativo solo con Firebase`);
  });
});