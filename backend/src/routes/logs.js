const express = require("express");
const { obtenerLogs, obtenerEstadisticasLogs } = require("../utils/logger");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { accion, documento, fechaDesde, fechaHasta } = req.query;
    
    console.log('📊 Consulta de logs recibida:', { accion, documento, fechaDesde, fechaHasta });
    
    const logs = await obtenerLogs(accion, documento, fechaDesde, fechaHasta);
    
    const response = {
      logs: logs,
      metadata: {
        total_count: logs.length,
        query_filters: {
          accion: accion || null,
          documento: documento || null,
          fecha_desde: fechaDesde || null,
          fecha_hasta: fechaHasta || null
        },
        data_sources: {
          mongodb: logs.filter(log => log.fuente === 'mongodb').length,
          firebase: logs.filter(log => log.fuente === 'firebase').length
        },
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('✅ Logs enviados:', response.metadata);
    res.json(logs); 
    
  } catch (error) {
    console.error("❌ Error en ruta de logs:", error);
    res.status(500).json({ 
      error: "Error al obtener logs",
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const estadisticas = await obtenerEstadisticasLogs();
    res.json(estadisticas);
  } catch (error) {
    console.error("❌ Error obteniendo estadísticas de logs:", error);
    res.status(500).json({ 
      error: "Error al obtener estadísticas",
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.get("/export", async (req, res) => {
  try {
    const { formato = 'json', limite = 1000 } = req.query;
    const logs = await obtenerLogs(null, null, null, null);
    
    const exportData = logs.slice(0, parseInt(limite));
    
    if (formato === 'csv') {
      const csvHeaders = 'Fecha,Accion,Detalles,Categoria,Fuente\n';
      const csvData = exportData.map(log => 
        `"${log.fecha}","${log.accion}","${log.detalles}","${log.categoria || 'sistema'}","${log.fuente || 'firebase'}"`
      ).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=logs_${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csvHeaders + csvData);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=logs_${new Date().toISOString().split('T')[0]}.json`);
      res.json({
        export_info: {
          total_records: exportData.length,
          export_date: new Date().toISOString(),
          format: 'json'
        },
        logs: exportData
      });
    }
  } catch (error) {
    console.error("❌ Error exportando logs:", error);
    res.status(500).json({ 
      error: "Error al exportar logs",
      details: error.message
    });
  }
});

module.exports = router;