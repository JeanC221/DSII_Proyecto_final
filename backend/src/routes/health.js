const express = require("express");
const axios = require("axios");
const router = express.Router();

const llmServiceUrl = process.env.LLM_SERVICE_URL || "http://llm_service:8000";

router.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "backend",
    timestamp: new Date().toISOString()
  });
});

router.get("/rag", async (req, res) => {
  try {
    const response = await axios.get(`${llmServiceUrl}/health`, { 
      timeout: 3000
    });
    
    res.json({
      status: response.data.status || "ok",
      service: "rag",
      firebase: response.data.firebase || "unknown", 
      llm_model: response.data.llm_model || "unknown",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error al verificar estado del servicio RAG:', error.message);
    
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