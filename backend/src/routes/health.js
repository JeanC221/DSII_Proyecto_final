// backend/src/routes/health.js
const express = require("express");
const axios = require("axios");
const router = express.Router();

// Configuración del cliente para el servicio LLM
const llmServiceUrl = process.env.LLM_SERVICE_URL || "http://llm_service:8000";

// Endpoint para verificar el estado del backend
router.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "backend",
    timestamp: new Date().toISOString()
  });
});

// Endpoint para verificar el estado del servicio RAG
router.get("/rag", async (req, res) => {
  try {
    // Intentar conectar con el servicio RAG
    const response = await axios.get(`${llmServiceUrl}/health`, { 
      timeout: 3000 // Timeout de 3 segundos para no bloquear la respuesta
    });
    
    // Devolver el estado del servicio RAG
    res.json({
      status: response.data.status || "ok",
      service: "rag",
      mongodb: response.data.mongodb || "unknown",
      llm_model: response.data.llm_model || "unknown",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error al verificar estado del servicio RAG:', error.message);
    
    // Devolver error si no se puede conectar
    res.json({
      status: "error",
      service: "rag",
      message: "No se pudo conectar con el servicio RAG",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;