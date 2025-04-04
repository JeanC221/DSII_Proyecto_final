const express = require("express");  
const Persona = require("../models/Persona");  
const router = express.Router();  

// Crear persona  
router.post("/", async (req, res) => {  
  try {  
    const nuevaPersona = new Persona(req.body);  
    await nuevaPersona.save();  
    res.status(201).json(nuevaPersona);  
  } catch (error) {  
    res.status(400).json({ error: error.message });  
  }  
});  

// Obtener todas las personas  
router.get("/", async (req, res) => {  
  try {  
    const personas = await Persona.find();  
    res.json(personas);  
  } catch (error) {  
    res.status(500).json({ error: "Error al obtener datos" });  
  }  
});  

module.exports = router;  