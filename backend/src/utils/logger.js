const mongoose = require('mongoose');

// Definir el schema para los logs
const logSchema = new mongoose.Schema({
  accion: {
    type: String,
    enum: ['Crear', 'Consultar', 'Actualizar', 'Eliminar', 'Consulta Natural'],
    required: true
  },
  detalles: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const Log = mongoose.model('Log', logSchema);

// Función para registrar una acción
const registrarLog = async (accion, detalles) => {
  try {
    const nuevoLog = new Log({
      accion,
      detalles
    });
    await nuevoLog.save();
    console.log(`Log registrado: ${accion} - ${detalles}`);
  } catch (error) {
    console.error('Error al registrar log:', error);
  }
};

// Función para obtener todos los logs
const obtenerLogs = async () => {
  try {
    return await Log.find().sort({ timestamp: -1 });
  } catch (error) {
    console.error('Error al obtener logs:', error);
    return [];
  }
};

module.exports = {
  registrarLog,
  obtenerLogs,
  Log
};