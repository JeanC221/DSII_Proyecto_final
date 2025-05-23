const express = require("express");
const personasRouter = require("./routes/personas");
const logsRouter = require("./routes/logs");
const consultaNaturalRouter = require("./routes/consultaNatural");
const healthRouter = require("./routes/health");
const cors = require("cors");
const { db } = require("./config/firebaseConfig");
const { Timestamp } = require('firebase-admin/firestore');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: ['http://localhost:3000', 'http://frontend', 'http://localhost'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/personas", personasRouter);
app.use("/api/logs", logsRouter);
app.use("/api/consulta-natural", consultaNaturalRouter);
app.use("/api/health", healthRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Error en el servidor" });
});

app.use('*', (req, res) => {
  console.log(`❌ Ruta no encontrada: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: "Ruta no encontrada",
    path: req.originalUrl,
    method: req.method 
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
  console.log(`🔗 LLM Service URL: ${process.env.LLM_SERVICE_URL || "http://rag_service:8000"}`);
  console.log(`📋 Available routes:`);
  console.log(`   GET  /api/health - Backend health check`);
  console.log(`   GET  /api/health/rag - RAG service health check`);
  console.log(`   POST /api/consulta-natural - Natural language queries`);
  console.log(`   CRUD /api/personas - Person management`);
  console.log(`   GET  /api/logs - Activity logs`);
});