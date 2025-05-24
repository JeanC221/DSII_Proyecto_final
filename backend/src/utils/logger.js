const { db } = require('../config/firebaseConfig');
const { mongoManager } = require('../config/mongoConfig');
const { Timestamp } = require('firebase-admin/firestore');

// Colección Firebase (mantener para compatibilidad)
const firebaseLogsCollection = db.collection('logs');

/**
 * Sistema híbrido de logging: Firebase + MongoDB
 * Firebase: Logs críticos del sistema
 * MongoDB: Logs de auditoría y consultas
 */

/**
 * Registra un log en ambos sistemas con fallback inteligente
 * @param {string} accion - Tipo de acción realizada
 * @param {string} detalles - Descripción detallada del evento
 * @param {string} categoria - Categoría del log (sistema, usuario, consulta)
 * @returns {Promise<void>}
 */
const registrarLog = async (accion, detalles, categoria = 'sistema') => {
  const logEntry = {
    accion,
    detalles,
    categoria,
    timestamp: new Date(),
    ip: null, // Se puede agregar más adelante
    user_agent: null
  };

  // Intentar guardar en MongoDB primero (nuevos logs)
  let mongoSuccess = false;
  try {
    if (await mongoManager.isHealthy()) {
      const db = mongoManager.getDatabase();
      const logsCollection = db.collection('logs');
      
      await logsCollection.insertOne({
        ...logEntry,
        created_at: new Date(),
        updated_at: new Date()
      });
      
      mongoSuccess = true;
      console.log(`📝 Log MongoDB: ${accion} - ${detalles}`);
    }
  } catch (error) {
    console.warn('⚠️ MongoDB Log falló, usando Firebase como fallback:', error.message);
  }

  // Firebase como fallback o logs críticos
  try {
    await firebaseLogsCollection.add({
      ...logEntry,
      timestamp: Timestamp.now(),
      mongo_logged: mongoSuccess
    });
    
    if (!mongoSuccess) {
      console.log(`📝 Log Firebase: ${accion} - ${detalles}`);
    }
  } catch (error) {
    console.error('❌ Error crítico: Ambos sistemas de logging fallaron:', error);
    
    // Log de emergencia a archivo (último recurso)
    console.error(`EMERGENCY LOG: ${new Date().toISOString()} - ${accion} - ${detalles}`);
  }
};

/**
 * Obtiene logs con consulta híbrida inteligente
 * @param {string} [accion] - Filtro por acción
 * @param {string} [documento] - Filtro por documento en detalles
 * @param {Date} [fechaDesde] - Fecha inicio del rango
 * @param {Date} [fechaHasta] - Fecha fin del rango
 * @returns {Promise<Array>} Array de logs combinados
 */
const obtenerLogs = async (accion, documento, fechaDesde, fechaHasta) => {
  const logs = [];
  
  // Intentar obtener desde MongoDB primero (más eficiente)
  try {
    if (await mongoManager.isHealthy()) {
      const mongoLogs = await obtenerLogsMongo(accion, documento, fechaDesde, fechaHasta);
      logs.push(...mongoLogs);
      console.log(`📊 MongoDB: ${mongoLogs.length} logs obtenidos`);
    }
  } catch (error) {
    console.warn('⚠️ Error obteniendo logs de MongoDB:', error.message);
  }
  
  // Obtener desde Firebase (logs históricos + fallback)
  try {
    const firebaseLogs = await obtenerLogsFirebase(accion, documento, fechaDesde, fechaHasta);
    
    // Evitar duplicados si ya tenemos logs de MongoDB
    const filteredFirebaseLogs = logs.length > 0 
      ? firebaseLogs.filter(fbLog => !fbLog.mongo_logged)
      : firebaseLogs;
    
    logs.push(...filteredFirebaseLogs);
    console.log(`📊 Firebase: ${filteredFirebaseLogs.length} logs obtenidos`);
  } catch (error) {
    console.error('❌ Error obteniendo logs de Firebase:', error);
  }
  
  // Ordenar por timestamp descendente y eliminar duplicados
  return logs
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 1000); // Limitar resultados para rendimiento
};

/**
 * Obtiene logs desde MongoDB con filtros avanzados
 */
const obtenerLogsMongo = async (accion, documento, fechaDesde, fechaHasta) => {
  const db = mongoManager.getDatabase();
  const logsCollection = db.collection('logs');
  
  // Construir filtros dinámicamente
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

/**
 * Obtiene logs desde Firebase (compatibilidad)
 */
const obtenerLogsFirebase = async (accion, documento, fechaDesde, fechaHasta) => {
  let query = firebaseLogsCollection.orderBy('timestamp', 'desc').limit(500);
  
  const snapshot = await query.get();
  const logs = [];
  
  snapshot.forEach(doc => {
    const data = doc.data();
    const timestamp = data.timestamp ? data.timestamp.toDate() : new Date();
    
    // Aplicar filtros manualmente (Firebase tiene limitaciones)
    let cumpleFiltros = true;
    
    if (accion && !data.accion.toLowerCase().includes(accion.toLowerCase())) {
      cumpleFiltros = false;
    }
    
    if (documento && !data.detalles.toLowerCase().includes(documento.toLowerCase())) {
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

/**
 * Obtiene estadísticas de logs para dashboard
 */
const obtenerEstadisticasLogs = async () => {
  try {
    const stats = {
      total_logs: 0,
      logs_hoy: 0,
      logs_por_categoria: {},
      sistema_activo: {
        mongodb: await mongoManager.isHealthy(),
        firebase: true // Asumimos que Firebase está siempre disponible
      }
    };
    
    // Estadísticas de MongoDB si está disponible
    if (stats.sistema_activo.mongodb) {
      const db = mongoManager.getDatabase();
      const logsCollection = db.collection('logs');
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      stats.total_logs = await logsCollection.countDocuments();
      stats.logs_hoy = await logsCollection.countDocuments({
        timestamp: { $gte: today }
      });
      
      // Agregación por categoría
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
      sistema_activo: { mongodb: false, firebase: true }
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