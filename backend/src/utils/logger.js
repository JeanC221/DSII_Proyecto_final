const admin = require('../config/firebaseConfig');
const { mongoManager } = require('../config/mongoConfig');

let firebaseLogsCollection = null;
let db = null;

if (admin) {
  try {
    db = admin.firestore();
    firebaseLogsCollection = db.collection('logs');
    console.log('✅ Firebase Firestore configurado para logging');
  } catch (error) {
    console.warn('⚠️ Error configurando Firebase para logs:', error.message);
  }
} else {
  console.warn('⚠️ Firebase no disponible - Solo se usará MongoDB para logs');
}


/**
 * @param {string} accion 
 * @param {string} detalles 
 * @param {string} categoria 
 * @returns {Promise<void>}
 */
const registrarLog = async (accion, detalles, categoria = 'sistema') => {
  const logEntry = {
    accion,
    detalles,
    categoria,
    timestamp: new Date(),
    ip: null,
    user_agent: null
  };

  let mongoSuccess = false;
  try {
    if (await mongoManager.isHealthy()) {
      const dbMongo = mongoManager.getDatabase();
      const logsCollection = dbMongo.collection('logs');
      
      await logsCollection.insertOne({
        ...logEntry,
        created_at: new Date(),
        updated_at: new Date()
      });
      
      mongoSuccess = true;
      console.log(`📝 Log MongoDB: ${accion} - ${detalles}`);
    }
  } catch (error) {
    console.warn('⚠️ MongoDB Log falló:', error.message);
  }

  if (firebaseLogsCollection) {
    try {
      await firebaseLogsCollection.add({
        ...logEntry,
        timestamp: admin.firestore.Timestamp.now(),
        mongo_logged: mongoSuccess
      });
      
      if (!mongoSuccess) {
        console.log(`📝 Log Firebase (fallback): ${accion} - ${detalles}`);
      }
    } catch (error) {
      console.error('❌ Error en Firebase logging:', error.message);
    }
  }

  if (!mongoSuccess && !firebaseLogsCollection) {
    console.error(`🚨 EMERGENCY LOG: ${new Date().toISOString()} - ${accion} - ${detalles}`);
    
  }
};


const obtenerLogs = async (accion, documento, fechaDesde, fechaHasta) => {
  const logs = [];
  
  try {
    if (await mongoManager.isHealthy()) {
      const mongoLogs = await obtenerLogsMongo(accion, documento, fechaDesde, fechaHasta);
      logs.push(...mongoLogs);
      console.log(`📊 MongoDB: ${mongoLogs.length} logs obtenidos`);
    }
  } catch (error) {
    console.warn('⚠️ Error obteniendo logs de MongoDB:', error.message);
  }
  
  if (logs.length === 0 && firebaseLogsCollection) {
    try {
      const firebaseLogs = await obtenerLogsFirebase(accion, documento, fechaDesde, fechaHasta);
      logs.push(...firebaseLogs);
      console.log(`📊 Firebase (fallback): ${firebaseLogs.length} logs obtenidos`);
    } catch (error) {
      console.error('❌ Error obteniendo logs de Firebase:', error.message);
    }
  }
  
  return logs
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 1000);
};


const obtenerLogsMongo = async (accion, documento, fechaDesde, fechaHasta) => {
  const dbMongo = mongoManager.getDatabase();
  const logsCollection = dbMongo.collection('logs');
  
  const filters = {};
  
  if (accion) {
    filters.accion = { $regex: accion, $options: 'i' };
  }
  
  if (documento) {
    filters.detalles = { $regex: documento, $options: 'i' };
  }
  
  if (fechaDesde || fechaHasta) {
    filters.timestamp = {};
    if (fechaDesde) filters.timestamp.$gte = new Date(fechaDesde);
    if (fechaHasta) filters.timestamp.$lte = new Date(fechaHasta);
  }
  
  const cursor = logsCollection
    .find(filters)
    .sort({ timestamp: -1 })
    .limit(500);
  
  const mongoLogs = await cursor.toArray();
  
  return mongoLogs.map(log => ({
    id: log._id.toString(),
    accion: log.accion,
    detalles: log.detalles,
    categoria: log.categoria || 'sistema',
    timestamp: log.timestamp,
    fecha: log.timestamp.toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }),
    fuente: 'mongodb'
  }));
};

const obtenerLogsFirebase = async (accion, documento, fechaDesde, fechaHasta) => {
  if (!firebaseLogsCollection) {
    return [];
  }

  let query = firebaseLogsCollection.orderBy('timestamp', 'desc').limit(500);
  
  const snapshot = await query.get();
  const logs = [];
  
  snapshot.forEach(doc => {
    const data = doc.data();
    const timestamp = data.timestamp ? data.timestamp.toDate() : new Date();
    
    let cumpleFiltros = true;
    
    if (accion && !data.accion?.toLowerCase().includes(accion.toLowerCase())) {
      cumpleFiltros = false;
    }
    
    if (documento && !data.detalles?.toLowerCase().includes(documento.toLowerCase())) {
      cumpleFiltros = false;
    }
    
    if (fechaDesde && timestamp < new Date(fechaDesde)) {
      cumpleFiltros = false;
    }
    
    if (fechaHasta && timestamp > new Date(fechaHasta)) {
      cumpleFiltros = false;
    }
    
    if (cumpleFiltros) {
      logs.push({
        id: doc.id,
        accion: data.accion,
        detalles: data.detalles,
        categoria: data.categoria || 'sistema',
        timestamp: timestamp,
        fecha: timestamp.toLocaleString('es-CO', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        fuente: 'firebase',
        mongo_logged: data.mongo_logged || false
      });
    }
  });
  
  return logs;
};


const obtenerEstadisticasLogs = async () => {
  try {
    const stats = {
      total_logs: 0,
      logs_hoy: 0,
      logs_por_categoria: {},
      sistema_activo: {
        mongodb: await mongoManager.isHealthy(),
        firebase: !!firebaseLogsCollection
      }
    };
    
    if (stats.sistema_activo.mongodb) {
      const dbMongo = mongoManager.getDatabase();
      const logsCollection = dbMongo.collection('logs');
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      stats.total_logs = await logsCollection.countDocuments();
      stats.logs_hoy = await logsCollection.countDocuments({
        timestamp: { $gte: today }
      });
      
      const categoriasPipeline = [
        { $group: { _id: "$categoria", count: { $sum: 1 } } }
      ];
      
      const categoriasResult = await logsCollection.aggregate(categoriasPipeline).toArray();
      categoriasResult.forEach(item => {
        stats.logs_por_categoria[item._id || 'sin_categoria'] = item.count;
      });
    }
    
    return stats;
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    return {
      error: 'No se pudieron obtener estadísticas',
      sistema_activo: { 
        mongodb: false, 
        firebase: !!firebaseLogsCollection 
      }
    };
  }
};

module.exports = {
  registrarLog,
  obtenerLogs,
  obtenerEstadisticasLogs,
  obtenerLogsMongo,
  obtenerLogsFirebase
};