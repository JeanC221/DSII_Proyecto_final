const express = require("express");  
const Persona = require("../models/Persona");  
const { registrarLog } = require("../utils/logger");
const router = express.Router();  

// Crear persona  
router.post("/", async (req, res) => {  
  try {  
    const datosPersona = req.body;
    const nuevaPersona = await Persona.crear(datosPersona);
    
    await registrarLog("Crear", `Persona creada: ${nuevaPersona.primerNombre} ${nuevaPersona.apellidos}`);
    res.status(201).json(nuevaPersona);  
  } catch (error) {  
    res.status(400).json({ error: error.message });  
  }  
});  

// Obtener todas las personas  
router.get("/", async (req, res) => {  
  try {  
    const personas = await Persona.obtenerTodos();
    await registrarLog("Consultar", "Consulta de todas las personas");
    res.json(personas);  
  } catch (error) {  
    res.status(500).json({ error: "Error al obtener datos" });  
  }  
});

// Obtener una persona por ID
router.get("/:id", async (req, res) => {
  try {
    const persona = await Persona.obtenerPorId(req.params.id);
    await registrarLog("Consultar", `Consulta de persona: ${persona.primerNombre} ${persona.apellidos}`);
    res.json(persona);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// Actualizar persona
router.put("/:id", async (req, res) => {
  try {
    const datosActualizados = req.body;
    const personaActualizada = await Persona.actualizar(req.params.id, datosActualizados);
    
    await registrarLog("Actualizar", `Persona actualizada: ${personaActualizada.primerNombre} ${personaActualizada.apellidos}`);
    res.json(personaActualizada);
  } catch (error) {
    if (error.message.includes('no encontrada')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(400).json({ error: error.message });
    }
  }
});

// Eliminar persona
router.delete("/:id", async (req, res) => {
  try {
    const persona = await Persona.obtenerPorId(req.params.id);
    
    const resultado = await Persona.eliminar(req.params.id);
    
    await registrarLog("Eliminar", `Persona eliminada: ${persona.primerNombre} ${persona.apellidos}`);
    res.json(resultado);
  } catch (error) {
    if (error.message.includes('no encontrada')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Error al eliminar persona" });
    }
  }
});

module.exports = router;