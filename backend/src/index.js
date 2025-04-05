const express = require("express");
const mongoose = require("mongoose");
const personasRouter = require("./routes/personas");

const app = express();
const PORT = process.env.PORT || 5000;

const cors = require("cors");

app.use(cors()); 

// Conectar a MongoDB
mongoose.connect(process.env.MONGO_URI);

// Middlewares
app.use(express.json());

// Rutas
app.use("/api/personas", personasRouter);

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});