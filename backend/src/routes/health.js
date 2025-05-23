const express = require("express");
const axios = require("axios");
const router = express.Router();

const llmServiceUrl = process.env.LLM_SERVICE_URL || "http://rag_service:8000";

router.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "backend",
    timestamp: new Date().toISOString()
  });
});

router.get("/rag", async (req, res) => {
  try {
    console.log(`Consultando RAG health en: ${llmServiceUrl}/health`);
    
    const response = await axios.get(`${llmServiceUrl}/health`, { 
      timeout: 5000
    });
    
    console.log("RAG health response:", response.data);
    
    // Mapear respuesta del RAG service académico al formato esperado por frontend
    const ragData = response.data;
    
    res.json({
      status: ragData.status || "ok",
      service: "rag",
      firebase: ragData.components?.firebase || "unknown", 
      llm_model: ragData.components?.groq_llm || "unknown",
      data_retriever: ragData.components?.data_manager || "unknown",
      model_info: ragData.model_info || {},
      system_metrics: ragData.system_metrics || {},
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error al verificar estado del servicio RAG:', error.message);
    
    res.json({
      status: "error",
      service: "rag",
      message: "No se pudo conectar con el servicio RAG",
      error: error.message,
      llm_service_url: llmServiceUrl,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;