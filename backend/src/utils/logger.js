const { db } = require('../config/firebaseConfig');
const { Timestamp } = require('firebase-admin/firestore');

const logsCollection = db.collection('logs');

/**
 * @param {string} accion 
 * @param {string} detalles 
 * @returns {Promise<void>}
 */
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

/**
 * @param {string} [accion] 
 * @param {string} [documento] 
 * @returns {Promise<Array>} 
 */
const obtenerLogs = async (accion, documento) => {
  try {
    let query = logsCollection.orderBy('timestamp', 'desc');
    

    const snapshot = await query.get();
    const logs = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const timestamp = data.timestamp ? data.timestamp.toDate() : new Date();
      
      let cumpleFiltros = true;
      
      if (accion && !data.accion.toLowerCase().includes(accion.toLowerCase())) {
        cumpleFiltros = false;
      }
      
      if (documento && !data.detalles.toLowerCase().includes(documento.toLowerCase())) {
        cumpleFiltros = false;
      }
      
      if (cumpleFiltros) {
        logs.push({
          id: doc.id,
          ...data,
          fecha: timestamp.toLocaleString('es-CO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })
        });
      }
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