const express = require("express");
const { obtenerLogs } = require("../utils/logger");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { accion, documento } = req.query;
    
    const logs = await obtenerLogs(accion, documento);
    res.json(logs);
  } catch (error) {
    console.error("Error en ruta de logs:", error);
    res.status(500).json({ error: "Error al obtener logs" });
  }
});

module.exports = router;