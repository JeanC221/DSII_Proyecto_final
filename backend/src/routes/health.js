const express = require("express");
const axios = require("axios");
const { db } = require("../config/firebaseConfig");
const router = express.Router();

const llmServiceUrl = process.env.LLM_SERVICE_URL || "http://rag_service:8000";

router.get("/", async (req, res) => {
  try {
    const firebaseHealthy = await checkFirebaseHealth();
    
    res.json({
      status: firebaseHealthy ? "ok" : "degraded",
      service: "backend",
      components: {
        firebase: firebaseHealthy ? "connected" : "disconnected",
        express: "running"
      },
      timestamp: new Date().toISOString(),
      port: process.env.PORT || 5000
    });
  } catch (error) {
    console.error('Error en health check del backend:', error);
    res.status(500).json({
      status: "down",
      service: "backend", 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.get("/rag", async (req, res) => {
  try {
    console.log(`🔍 Consultando RAG health en: ${llmServiceUrl}/health`);
    
    const response = await axios.get(`${llmServiceUrl}/health`, { 
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    console.log("✅ RAG health response recibida:", response.status);
    
    const ragData = response.data;
    
    const firebaseStatus = ragData.components?.firebase === "healthy" ? "connected" : "disconnected";
    const llmStatus = ragData.components?.groq_llm === "healthy" ? "loaded" : "not loaded";
    const dataRetrieverStatus = ragData.components?.data_manager === "healthy" ? "available" : "unavailable";
    
    let overallStatus = "ok";
    if (ragData.status === "degraded" || 
        firebaseStatus === "disconnected" || 
        llmStatus === "not loaded") {
      overallStatus = "degraded";
    }
    if (ragData.status === "down") {
      overallStatus = "error";
    }
    
    const healthResponse = {
      status: overallStatus,
      service: "rag",
      firebase: firebaseStatus,
      llm_model: llmStatus,
      data_retriever: dataRetrieverStatus,
      model_info: ragData.model_info || {
        llm_provider: "Groq",
        model: "llama3-8b-8192"
      },
      system_metrics: ragData.system_metrics || {},
      capabilities: ragData.capabilities || [],
      version: ragData.version || "1.0.0",
      rag_service_url: llmServiceUrl,
      timestamp: new Date().toISOString()
    };
    
    console.log("📤 Enviando respuesta de health RAG:", {
      status: healthResponse.status,
      firebase: healthResponse.firebase,
      llm_model: healthResponse.llm_model
    });
    
    res.json(healthResponse);
    
  } catch (error) {
    console.error('❌ Error al verificar estado del servicio RAG:', {
      message: error.message,
      code: error.code,
      url: llmServiceUrl
    });
    
    const errorResponse = {
      status: "error",
      service: "rag",
      message: "No se pudo conectar con el servicio RAG",
      firebase: "unknown",
      llm_model: "not available", 
      data_retriever: "unavailable",
      error_details: {
        message: error.message,
        code: error.code || "CONNECTION_ERROR",
        target_url: llmServiceUrl,
        timeout_ms: 10000
      },
      troubleshooting: [
        "Verificar que el contenedor rag_service esté ejecutándose",
        "Comprobar la conectividad de red entre contenedores",
        "Revisar los logs del servicio RAG",
        "Confirmar que el puerto 8000 esté disponible"
      ],
      timestamp: new Date().toISOString()
    };
    
    res.json(errorResponse);
  }
});

async function checkFirebaseHealth() {
  try {
    if (!db) {
      return false;
    }
    
    await db.collection('personas').limit(1).get();
    return true;
  } catch (error) {
    console.error('Firebase health check failed:', error.message);
    return false;
  }
}

router.get("/debug", async (req, res) => {
  try {
    const firebaseHealthy = await checkFirebaseHealth();
    
    let ragConnectable = false;
    let ragError = null;
    
    try {
      const ragResponse = await axios.get(`${llmServiceUrl}/health`, { timeout: 5000 });
      ragConnectable = true;
    } catch (error) {
      ragError = error.message;
    }
    
    res.json({
      backend: {
        status: "running",
        port: process.env.PORT || 5000,
        firebase_connected: firebaseHealthy
      },
      rag_service: {
        target_url: llmServiceUrl,
        connectable: ragConnectable,
        error: ragError
      },
      environment: {
        node_env: process.env.NODE_ENV || "development",
        llm_service_url: process.env.LLM_SERVICE_URL,
        firebase_project_id: process.env.FIREBASE_PROJECT_ID
      },
      network: {
        docker_compose_service_name: "rag_service"
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: "Debug endpoint failed",
      message: error.message
    });
  }
});

module.exports = router;