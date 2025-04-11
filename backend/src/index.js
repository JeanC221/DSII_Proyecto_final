const express = require("express");
const mongoose = require("mongoose");
const personasRouter = require("./routes/personas");
const logsRouter = require("./routes/logs");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;

// Configuración de CORS
app.use(cors());

// Configuración para subir archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 } // Límite de 2MB
});

// Asegurarse de que el directorio existe
const fs = require("fs");
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// Servir archivos estáticos
app.use("/uploads", express.static("uploads"));

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Conectar a MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB conectado"))
  .catch(err => console.error("Error al conectar a MongoDB:", err));

// Rutas
app.use("/api/personas", personasRouter);
app.use("/api/logs", logsRouter);

// Ruta para integración con el servicio LLM
app.post("/api/consulta-natural", async (req, res) => {
  try {
    const { consulta } = req.body;
    
    // Llamada al servicio LLM
    const llmResponse = await fetch("http://llm_service:8000/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query: consulta })
    });
    
    const data = await llmResponse.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Error al procesar consulta" });
  }
});

// Manejador de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Error en el servidor" });
});

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});