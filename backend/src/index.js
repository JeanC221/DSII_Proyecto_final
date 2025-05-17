const express = require("express");
const personasRouter = require("./routes/personas");
const logsRouter = require("./routes/logs");
const cors = require("cors");
const { db } = require("./config/firebaseConfig");
const { Timestamp } = require('firebase-admin/firestore');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: ['http://localhost:3000', 'http://frontend', 'http://localhost'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/personas", personasRouter);
app.use("/api/logs", logsRouter);

// Ruta para consultas en lenguaje natural
app.post("/api/consulta-natural", async (req, res) => {
  try {
    const { consulta } = req.body;
    
    await db.collection('logs').add({
      accion: 'Consulta Natural',
      detalles: `Consulta: ${consulta}`,
      timestamp: Timestamp.now()
    });
    
    // Respuestas simuladas según la consulta
    let respuesta = "";
    const query = consulta.toLowerCase();
    
    if (query.includes("joven")) {
      respuesta = "Pedro Pérez es la persona más joven registrada.";
    } else if (query.includes("femenino") || query.includes("mujer")) {
      respuesta = "Hay 3 personas de género femenino registradas.";
    } else if (query.includes("masculino") || query.includes("hombre")) {
      respuesta = "Hay 5 personas de género masculino registradas.";
    } else if (query.includes("edad") || query.includes("promedio")) {
      respuesta = "El promedio de edad es 35.2 años.";
    } else if (query.includes("última") || query.includes("reciente")) {
      respuesta = "La última persona registrada es María López.";
    } else {
      respuesta = "Actualmente hay 8 personas registradas en el sistema.";
    }
    
    res.json({ answer: respuesta });
  } catch (error) {
    console.error('Error al procesar consulta:', error);
    res.status(500).json({ error: "Error al procesar consulta" });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ 
    status: "OK",
    message: "Firebase Firestore conectado correctamente",
    project: process.env.FIREBASE_PROJECT_ID || "Default Project"
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Error en el servidor" });
});

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});