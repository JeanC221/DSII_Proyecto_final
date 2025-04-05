const mongoose = require("mongoose");

const personaSchema = new mongoose.Schema({
  primerNombre: {
    type: String,
    required: true,
    maxlength: 30,
    match: /^[A-Za-z ]+$/
  },
  apellidos: {
    type: String,
    required: true,
    maxlength: 60
  },
  fechaNacimiento: {
    type: Date,
    required: true
  },
  genero: {
    type: String,
    enum: ["Masculino", "Femenino", "No binario", "Prefiero no reportar"],
    required: true
  },
  correo: {
    type: String,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    required: true
  },
  celular: {
    type: String,
    validate: {
      validator: v => /^\d{10}$/.test(v),
      message: "Celular debe tener 10 dígitos"
    }
  },
  nroDocumento: {
    type: String,
    validate: {
      validator: v => /^\d{1,10}$/.test(v),
      message: "Máximo 10 dígitos"
    }
  },
  tipoDocumento: {
    type: String,
    enum: ["Tarjeta de identidad", "Cédula"]
  },
  foto: {
    type: String, // Ruta del archivo o URL
    validate: {
      validator: v => v ? v.length <= 2 * 1024 * 1024 : true, // 2MB (validación de tamaño en frontend)
      message: "La foto no debe superar 2MB"
    }
  }
});

module.exports = mongoose.model("Persona", personaSchema);