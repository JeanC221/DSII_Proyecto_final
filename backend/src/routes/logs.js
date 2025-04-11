const express = require("express");
const { obtenerLogs } = require("../utils/logger");
const router = express.Router();

// Obtener todos los logs
router.get("/", async (req, res) => {
  try {
    const logs = await obtenerLogs();
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener logs" });
  }
});

module.exports = router;