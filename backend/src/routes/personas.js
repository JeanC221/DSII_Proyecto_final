const express = require("express");  
const Persona = require("../models/Persona");  
const { registrarLog } = require("../utils/logger");
const router = express.Router();  

router.post("/", async (req, res) => {
  try {
    const persona = await Persona.crear(req.body);
    
    await registrarLog(
      "Crear", 
      `Persona creada: ${persona.primerNombre} ${persona.apellidos} (Doc: ${persona.nroDocumento})`
    );
    
    res.status(201).json(persona);
  } catch (error) {
    console.error('Error al guardar persona:', error);
    
    await registrarLog(
      "Crear - Error", 
      `Error al crear persona: ${error.message} (Datos: ${JSON.stringify(req.body).substring(0, 100)})`
    );
    
    res.status(500).json({ error: error.message, details: error });
  }
});  

router.get("/", async (req, res) => {  
  try {  
    const personas = await Persona.obtenerTodos();
    
    await registrarLog(
      "Consultar", 
      `Consulta de todas las personas (${personas.length} registros)`
    );
    
    res.json(personas);  
  } catch (error) {  
    console.error('Error al obtener personas:', error);
    
    await registrarLog(
      "Consultar - Error", 
      `Error al consultar todas las personas: ${error.message}`
    );
    
    res.status(500).json({ error: "Error al obtener datos" });  
  }  
});

router.get("/:id", async (req, res) => {
  try {
    const persona = await Persona.obtenerPorId(req.params.id);
    
    await registrarLog(
      "Consultar", 
      `Consulta individual: ${persona.primerNombre} ${persona.apellidos} (ID: ${req.params.id})`
    );
    
    res.json(persona);
  } catch (error) {
    console.error('Error al obtener persona:', error);
    
    await registrarLog(
      "Consultar - Error", 
      `Error al consultar persona ID ${req.params.id}: ${error.message}`
    );
    
    res.status(404).json({ error: error.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const datosActualizados = req.body;
    const personaActualizada = await Persona.actualizar(req.params.id, datosActualizados);
    
    const camposActualizados = Object.keys(datosActualizados).join(', ');
    
    await registrarLog(
      "Actualizar", 
      `Persona actualizada: ${personaActualizada.primerNombre} ${personaActualizada.apellidos} (Campos: ${camposActualizados})`
    );
    
    res.json(personaActualizada);
  } catch (error) {
    console.error('Error al actualizar persona:', error);
    
    await registrarLog(
      "Actualizar - Error", 
      `Error al actualizar persona ID ${req.params.id}: ${error.message}`
    );
    
    if (error.message.includes('no encontrada')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(400).json({ error: error.message });
    }
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const persona = await Persona.obtenerPorId(req.params.id);
    const resultado = await Persona.eliminar(req.params.id);
    
    await registrarLog(
      "Eliminar", 
      `Persona eliminada: ${persona.primerNombre} ${persona.apellidos} (Doc: ${persona.nroDocumento})`
    );
    
    res.json(resultado);
  } catch (error) {
    console.error('Error al eliminar persona:', error);
    
    await registrarLog(
      "Eliminar - Error", 
      `Error al eliminar persona ID ${req.params.id}: ${error.message}`
    );
    
    if (error.message.includes('no encontrada')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Error al eliminar persona" });
    }
  }
});

module.exports = router;