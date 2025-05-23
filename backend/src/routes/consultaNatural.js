const express = require("express");
const axios = require("axios");
const { registrarLog } = require("../utils/logger");
const Persona = require("../models/Persona");
const router = express.Router();

const llmServiceUrl = process.env.LLM_SERVICE_URL || "http://llm_service:8000";

router.post("/", async (req, res) => {
  try {
    const { consulta } = req.body;
    
    if (!consulta || typeof consulta !== 'string' || consulta.trim() === '') {
      await registrarLog(
        "Consulta Natural - Error", 
        "Consulta vacía o inválida recibida"
      );
      return res.status(400).json({ error: "La consulta es requerida y debe ser un texto" });
    }

    await registrarLog(
      "Consulta Natural", 
      `Consulta recibida: "${consulta.substring(0, 100)}${consulta.length > 100 ? '...' : ''}"`
    );
    
    try {
      const response = await axios.post(
        `${llmServiceUrl}/query`, 
        { query: consulta },
        { timeout: 15000 } 
      );
      
      const answer = response.data.answer;
      
      await registrarLog(
        "Consulta Natural - Éxito", 
        `Respuesta RAG: "${answer.substring(0, 100)}${answer.length > 100 ? '...' : ''}"`
      );
      
      return res.json({ answer });
    } catch (error) {
      console.error('Error al comunicarse con el servicio RAG:', error.message);
      
      const fallbackAnswer = await getIntelligentFallback(consulta);
      
      await registrarLog(
        "Consulta Natural - Fallback", 
        `Servicio RAG no disponible. Respuesta local: "${fallbackAnswer.substring(0, 100)}${fallbackAnswer.length > 100 ? '...' : ''}"`
      );
      
      return res.json({ answer: fallbackAnswer });
    }
  } catch (error) {
    console.error('Error al procesar consulta natural:', error);
    
    await registrarLog(
      "Consulta Natural - Error", 
      `Error interno al procesar consulta: ${error.message}`
    );
    
    res.status(500).json({ error: "Error al procesar consulta" });
  }
});

/**
 * Genera respuestas inteligentes usando datos reales de la base de datos
 * @param {string} consulta - La consulta original del usuario
 * @returns {Promise<string>} - Respuesta generada basada en datos reales
 */
async function getIntelligentFallback(consulta) {
  const query = consulta.toLowerCase();
  
  try {
    const personas = await Persona.obtenerTodos();
    
    if (!personas || personas.length === 0) {
      return "No hay personas registradas en el sistema actualmente.";
    }
    
    const total = personas.length;
    
    if (query.includes("total") || query.includes("cuántas") || query.includes("cuantas") || query.includes("cantidad")) {
      return `En el sistema hay registradas ${total} ${total === 1 ? 'persona' : 'personas'} en total.`;
    }
    
    if (query.includes("género") || query.includes("genero")) {
      const genderCount = {};
      personas.forEach(persona => {
        const gender = persona.genero || 'No especificado';
        genderCount[gender] = (genderCount[gender] || 0) + 1;
      });
      
      if (query.includes("femenino") || query.includes("mujer") || query.includes("mujeres")) {
        const count = genderCount['Femenino'] || 0;
        const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
        return `Hay ${count} ${count === 1 ? 'persona' : 'personas'} de género femenino registradas (${percentage}% del total).`;
      }
      
      if (query.includes("masculino") || query.includes("hombre") || query.includes("hombres")) {
        const count = genderCount['Masculino'] || 0;
        const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
        return `Hay ${count} ${count === 1 ? 'persona' : 'personas'} de género masculino registradas (${percentage}% del total).`;
      }
      
      if (query.includes("no binario")) {
        const count = genderCount['No binario'] || 0;
        return `Hay ${count} ${count === 1 ? 'persona' : 'personas'} registradas como no binario.`;
      }
      
      let response = "La distribución por género es:\n";
      Object.entries(genderCount).forEach(([gender, count]) => {
        const percentage = ((count / total) * 100).toFixed(1);
        response += `• ${gender}: ${count} ${count === 1 ? 'persona' : 'personas'} (${percentage}%)\n`;
      });
      return response.trim();
    }
    
    if (query.includes("edad") || query.includes("promedio") || query.includes("media")) {
      const ages = personas
        .map(persona => {
          if (!persona.fechaNacimiento) return null;
          const birthDate = new Date(persona.fechaNacimiento);
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          return age;
        })
        .filter(age => age !== null && age >= 0);
      
      if (ages.length === 0) {
        return "No se pueden calcular estadísticas de edad porque no hay fechas de nacimiento válidas.";
      }
      
      const avgAge = (ages.reduce((sum, age) => sum + age, 0) / ages.length).toFixed(1);
      const minAge = Math.min(...ages);
      const maxAge = Math.max(...ages);
      
      return `Estadísticas de edad basadas en ${ages.length} registros:\n• Promedio: ${avgAge} años\n• Edad mínima: ${minAge} años\n• Edad máxima: ${maxAge} años`;
    }
    
    if (query.includes("joven") || query.includes("menor") || query.includes("edad mínima")) {
      let youngest = null;
      let youngestAge = Infinity;
      
      personas.forEach(persona => {
        if (!persona.fechaNacimiento) return;
        const birthDate = new Date(persona.fechaNacimiento);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        
        if (age < youngestAge) {
          youngestAge = age;
          youngest = persona;
        }
      });
      
      if (!youngest) {
        return "No se puede determinar la persona más joven porque no hay fechas de nacimiento válidas.";
      }
      
      return `La persona más joven registrada es ${youngest.primerNombre} ${youngest.apellidos} con ${youngestAge} años.`;
    }
    
    if (query.includes("mayor") || query.includes("viejo") || query.includes("edad máxima")) {
      let oldest = null;
      let oldestAge = -1;
      
      personas.forEach(persona => {
        if (!persona.fechaNacimiento) return;
        const birthDate = new Date(persona.fechaNacimiento);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        
        if (age > oldestAge) {
          oldestAge = age;
          oldest = persona;
        }
      });
      
      if (!oldest) {
        return "No se puede determinar la persona mayor porque no hay fechas de nacimiento válidas.";
      }
      
      return `La persona mayor registrada es ${oldest.primerNombre} ${oldest.apellidos} con ${oldestAge} años.`;
    }
    
    if (query.includes("última") || query.includes("ultima") || query.includes("reciente") || query.includes("último registro")) {
      let lastPerson = null;
      let lastDate = null;
      
      personas.forEach(persona => {
        const createdAt = persona.createdAt;
        if (createdAt && (!lastDate || new Date(createdAt) > new Date(lastDate))) {
          lastDate = createdAt;
          lastPerson = persona;
        }
      });
      
      if (!lastPerson) {
        return "No se puede determinar la última persona registrada.";
      }
      
      const dateStr = new Date(lastDate).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      return `La última persona registrada fue ${lastPerson.primerNombre} ${lastPerson.apellidos} el ${dateStr}.`;
    }
    
    const docMatch = query.match(/\b\d{6,10}\b/);
    if (docMatch && (query.includes("documento") || query.includes("cedula") || query.includes("cédula"))) {
      const docNumber = docMatch[0];
      const persona = personas.find(p => p.nroDocumento === docNumber);
      
      if (persona) {
        return `Se encontró a ${persona.primerNombre} ${persona.segundoNombre || ''} ${persona.apellidos} con documento ${docNumber}. Género: ${persona.genero}, Correo: ${persona.correo}.`;
      } else {
        return `No se encontró ninguna persona con el número de documento ${docNumber}.`;
      }
    }
    
    if (query.includes("buscar") || query.includes("llamada") || query.includes("llamado") || query.includes("nombre")) {
      const nameMatch = query.match(/(?:buscar|llamada?|llamado|nombre)\s+(\w+)/i);
      if (nameMatch) {
        const searchName = nameMatch[1].toLowerCase();
        const matches = personas.filter(persona => 
          persona.primerNombre?.toLowerCase().includes(searchName) ||
          persona.segundoNombre?.toLowerCase().includes(searchName) ||
          persona.apellidos?.toLowerCase().includes(searchName)
        );
        
        if (matches.length === 0) {
          return `No se encontraron personas con el nombre "${searchName}".`;
        } else if (matches.length === 1) {
          const persona = matches[0];
          return `Se encontró a ${persona.primerNombre} ${persona.segundoNombre || ''} ${persona.apellidos} (Doc: ${persona.nroDocumento}).`;
        } else {
          let response = `Se encontraron ${matches.length} personas con el nombre "${searchName}":\n`;
          matches.slice(0, 5).forEach(persona => {
            response += `• ${persona.primerNombre} ${persona.segundoNombre || ''} ${persona.apellidos} (Doc: ${persona.nroDocumento})\n`;
          });
          if (matches.length > 5) {
            response += `... y ${matches.length - 5} más.`;
          }
          return response.trim();
        }
      }
    }
    
    const genderCount = {};
    personas.forEach(persona => {
      const gender = persona.genero || 'No especificado';
      genderCount[gender] = (genderCount[gender] || 0) + 1;
    });
    
    let response = `Resumen del sistema:\n`;
    response += `• Total de personas registradas: ${total}\n`;
    response += `• Distribución por género:\n`;
    Object.entries(genderCount).forEach(([gender, count]) => {
      response += `  - ${gender}: ${count}\n`;
    });
    response += `\nPuedes preguntar por estadísticas específicas, búsquedas por nombre o documento, edades, etc.`;
    
    return response;
    
  } catch (error) {
    console.error('Error en fallback inteligente:', error);
    return "No se pudo conectar con la base de datos para procesar tu consulta. Por favor, intenta más tarde.";
  }
}

module.exports = router;