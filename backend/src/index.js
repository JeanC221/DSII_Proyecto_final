const express = require("express");
const personasRouter = require("./routes/personas");
const logsRouter = require("./routes/logs");
const consultaNaturalRouter = require("./routes/consultaNatural");
const healthRouter = require("./routes/health");
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
app.use("/api/consulta-natural", consultaNaturalRouter);
app.use("/api/health", healthRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Error en el servidor" });
});

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
  console.log(`LLM Service URL: ${process.env.LLM_SERVICE_URL || "http://llm_service:8000"}`);
});