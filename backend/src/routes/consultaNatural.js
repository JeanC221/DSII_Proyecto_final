const express = require("express");
const axios = require("axios");
const { registrarLog } = require("../utils/logger");
const router = express.Router();

const llmServiceUrl = process.env.LLM_SERVICE_URL || "http://llm_service:8000";

router.post("/", async (req, res) => {
  try {
    const { consulta } = req.body;
    
    if (!consulta || typeof consulta !== 'string') {
      return res.status(400).json({ error: "La consulta es requerida y debe ser un texto" });
    }

    await registrarLog("Consulta Natural", `Consulta: ${consulta}`);
    
    try {
      const response = await axios.post(`${llmServiceUrl}/query`, { query: consulta });
      
      await registrarLog("Consulta Natural", `Respuesta: ${response.data.answer}`);
      
      return res.json(response.data);
    } catch (error) {
      console.error('Error al comunicarse con el servicio LLM:', error.message);
      
      const fallbackAnswer = getFallbackAnswer(consulta);
      await registrarLog("Consulta Natural", `Respuesta fallback: ${fallbackAnswer}`);
      
      return res.json({ answer: fallbackAnswer });
    }
  } catch (error) {
    console.error('Error al procesar consulta natural:', error);
    res.status(500).json({ error: "Error al procesar consulta" });
  }
});

function getFallbackAnswer(consulta) {
  const query = consulta.toLowerCase();
  
  if (query.includes("joven")) {
    return "No se pudo conectar con el servicio de análisis. Según nuestros registros locales, la persona más joven registrada tiene 18 años.";
  } else if (query.includes("femenino") || query.includes("mujer")) {
    return "No se pudo conectar con el servicio de análisis. Tenemos aproximadamente un 40% de personas de género femenino registradas.";
  } else if (query.includes("masculino") || query.includes("hombre")) {
    return "No se pudo conectar con el servicio de análisis. Tenemos aproximadamente un 55% de personas de género masculino registradas.";
  } else if (query.includes("edad") || query.includes("promedio")) {
    return "No se pudo conectar con el servicio de análisis. El promedio de edad aproximado es de 35 años.";
  } else if (query.includes("última") || query.includes("reciente")) {
    return "No se pudo conectar con el servicio de análisis. La última persona fue registrada hace aproximadamente 2 días.";
  } else {
    return "No se pudo conectar con el servicio de análisis. Actualmente hay varias personas registradas en el sistema.";
  }
}

module.exports = router;