const { db } = require('../config/firebaseConfig');
const { Timestamp } = require('firebase-admin/firestore');

const logsCollection = db.collection('logs');

// Función para registrar una acción
const registrarLog = async (accion, detalles) => {
  try {
    const nuevoLog = {
      accion,
      detalles,
      timestamp: Timestamp.now()
    };
    
    await logsCollection.add(nuevoLog);
    console.log(`Log registrado: ${accion} - ${detalles}`);
  } catch (error) {
    console.error('Error al registrar log:', error);
  }
};

// Función para obtener todos los logs
const obtenerLogs = async () => {
  try {
    const snapshot = await logsCollection.orderBy('timestamp', 'desc').get();
    const logs = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const timestamp = data.timestamp ? data.timestamp.toDate() : new Date();
      
      logs.push({
        id: doc.id,
        ...data,
        fecha: timestamp.toLocaleString()
      });
    });
    
    return logs;
  } catch (error) {
    console.error('Error al obtener logs:', error);
    return [];
  }
};

module.exports = {
  registrarLog,
  obtenerLogs
};