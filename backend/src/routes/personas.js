const express = require("express");  
const Persona = require("../models/Persona");  
const router = express.Router();  
const { registrarLog } = require("../utils/logger");

// Crear persona  
router.post("/", async (req, res) => {  
  try {  
    const nuevaPersona = new Persona(req.body);  
    await nuevaPersona.save();
    registrarLog("Crear", `Persona creada: ${nuevaPersona.primerNombre} ${nuevaPersona.apellidos}`);
    res.status(201).json(nuevaPersona);  
  } catch (error) {  
    res.status(400).json({ error: error.message });  
  }  
});  

// Obtener todas las personas  
router.get("/", async (req, res) => {  
  try {  
    const personas = await Persona.find();
    registrarLog("Consultar", "Consulta de todas las personas");
    res.json(personas);  
  } catch (error) {  
    res.status(500).json({ error: "Error al obtener datos" });  
  }  
});

// Obtener una persona por ID
router.get("/:id", async (req, res) => {
  try {
    const persona = await Persona.findById(req.params.id);
    if (!persona) {
      return res.status(404).json({ error: "Persona no encontrada" });
    }
    registrarLog("Consultar", `Consulta de persona: ${persona.primerNombre} ${persona.apellidos}`);
    res.json(persona);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener datos" });
  }
});

// Actualizar persona
router.put("/:id", async (req, res) => {
  try {
    const personaActualizada = await Persona.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!personaActualizada) {
      return res.status(404).json({ error: "Persona no encontrada" });
    }
    
    registrarLog("Actualizar", `Persona actualizada: ${personaActualizada.primerNombre} ${personaActualizada.apellidos}`);
    res.json(personaActualizada);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Eliminar persona
router.delete("/:id", async (req, res) => {
  try {
    const persona = await Persona.findById(req.params.id);
    if (!persona) {
      return res.status(404).json({ error: "Persona no encontrada" });
    }
    
    await Persona.findByIdAndDelete(req.params.id);
    registrarLog("Eliminar", `Persona eliminada: ${persona.primerNombre} ${persona.apellidos}`);
    res.json({ message: "Persona eliminada correctamente" });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar persona" });
  }
});

module.exports = router;