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
  fechaNacimiento: Date,  
  genero: {  
    type: String,  
    enum: ["Masculino", "Femenino", "No binario", "Prefiero no reportar"]  
  },  
  correo: {  
    type: String,  
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/  
  }  
});  

module.exports = mongoose.model("Persona", personaSchema);  