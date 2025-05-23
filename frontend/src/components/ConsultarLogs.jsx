import React, { useEffect, useState } from 'react';
import api from '../config/axiosConfig';
import styles from './ConsultarLogs.module.css';

const ConsultarLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtros, setFiltros] = useState({
    accion: '',
    documento: '',
    fechaDesde: '',
    fechaHasta: ''
  });

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/logs');
      setLogs(res.data);
      setError(null);
    } catch (err) {
      console.error('Error al cargar logs:', err);
      setError('Error al cargar los logs. Por favor, intente nuevamente más tarde.');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFiltros({ ...filtros, [name]: value });
  };

  const resetFilters = () => {
    setFiltros({ accion: '', documento: '', fechaDesde: '', fechaHasta: '' });
  };

  const logsFiltrados = logs.filter(log => {
    // Filtro por acción
    if (filtros.accion && !log.accion.toLowerCase().includes(filtros.accion.toLowerCase())) {
      return false;
    }
    
    // Filtro por documento
    if (filtros.documento && !log.detalles.toLowerCase().includes(filtros.documento.toLowerCase())) {
      return false;
    }
    
    // Filtro por fecha desde
    if (filtros.fechaDesde) {
      const fechaLog = new Date(log.fecha).toISOString().split('T')[0];
      if (fechaLog < filtros.fechaDesde) {
        return false;
      }
    }
    
    // Filtro por fecha hasta
    if (filtros.fechaHasta) {
      const fechaLog = new Date(log.fecha).toISOString().split('T')[0];
      if (fechaLog > filtros.fechaHasta) {
        return false;
      }
    }
    
    return true;
  });

  const getActionInfo = (accion) => {
    const accionLower = accion.toLowerCase();
    
    if (accionLower.includes('crear')) {
      return { icon: '➕', color: 'success', label: 'Crear' };
    }
    if (accionLower.includes('actualizar') || accionLower.includes('editar')) {
      return { icon: '✏️', color: 'info', label: 'Actualizar' };
    }
    if (accionLower.includes('eliminar')) {
      return { icon: '🗑️', color: 'danger', label: 'Eliminar' };
    }
    if (accionLower.includes('consulta natural') || accionLower.includes('rag')) {
      return { icon: '🤖', color: 'purple', label: 'Consulta IA' };
    }
    if (accionLower.includes('consultar')) {
      return { icon: '👁️', color: 'neutral', label: 'Consultar' };
    }
    
    return { icon: '📋', color: 'neutral', label: 'Sistema' };
  };

  const formatTimeAgo = (fecha) => {
    const now = new Date();
    const logDate = new Date(fecha);
    const diffInMinutes = Math.floor((now - logDate) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Hace un momento';
    if (diffInMinutes < 60) return `Hace ${diffInMinutes} min`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `Hace ${diffInHours}h`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `Hace ${diffInDays} días`;
    
    return logDate.toLocaleDateString('es-ES');
  };

  const getLogSummary = () => {
    const total = logsFiltrados.length;
    const tipos = {};
    
    logsFiltrados.forEach(log => {
      const actionInfo = getActionInfo(log.accion);
      tipos[actionInfo.label] = (tipos[actionInfo.label] || 0) + 1;
    });
    
    return { total, tipos };
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner}></div>
          <h3>Cargando registro de actividades...</h3>
          <p>Obteniendo historial del sistema</p>
        </div>
      </div>
    );
  }

  const summary = getLogSummary();

  return (
    <div className={styles.container}>
      {/* Header Section */}
      <div className={styles.headerSection}>
        <div className={styles.titleContainer}>
          <h2>
            <span className={styles.titleIcon}>📋</span>
            Registro de Actividades
          </h2>
          <p className={styles.subtitle}>
            Historial completo de todas las operaciones realizadas en el sistema
          </p>
        </div>
        
        <button 
          onClick={fetchLogs} 
          className={styles.refreshButton}
          disabled={loading}
        >
          <span className={styles.buttonIcon}>🔄</span>
          Actualizar
        </button>
      </div>

      {error && (
        <div className={styles.errorAlert}>
          <span className={styles.alertIcon}>⚠️</span>
          <div>
            <strong>Error al cargar registro</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Stats Summary */}
      <div className={styles.statsCard}>
        <div className={styles.statsHeader}>
          <h3>
            <span className={styles.statsIcon}>📊</span>
            Resumen de Actividad
          </h3>
        </div>
        <div className={styles.statsGrid}>
          <div className={styles.statItem}>
            <span className={styles.statNumber}>{summary.total}</span>
            <span className={styles.statLabel}>Total de registros</span>
          </div>
          {Object.entries(summary.tipos).slice(0, 4).map(([tipo, cantidad]) => (
            <div key={tipo} className={styles.statItem}>
              <span className={styles.statNumber}>{cantidad}</span>
              <span className={styles.statLabel}>{tipo}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filters Section */}
      <div className={styles.filtersCard}>
        <div className={styles.filtersHeader}>
          <h3>
            <span className={styles.filterIcon}>🔍</span>
            Filtros de Búsqueda
          </h3>
        </div>
        
        <div className={styles.filtersGrid}>
          <div className={styles.filterGroup}>
            <label htmlFor="accion">Tipo de acción</label>
            <select
              id="accion"
              name="accion"
              value={filtros.accion}
              onChange={handleFilterChange}
              className={styles.selectFilter}
            >
              <option value="">Todas las acciones</option>
              <option value="Crear">Crear</option>
              <option value="Actualizar">Actualizar</option>
              <option value="Eliminar">Eliminar</option>
              <option value="Consultar">Consultar</option>
              <option value="Consulta Natural">Consulta IA</option>
            </select>
          </div>
          
          <div className={styles.filterGroup}>
            <label htmlFor="documento">Buscar en detalles</label>
            <input
              type="text"
              id="documento"
              name="documento"
              value={filtros.documento}
              onChange={handleFilterChange}
              placeholder="Documento, nombre, etc."
              className={styles.searchInput}
            />
          </div>
          
          <div className={styles.filterGroup}>
            <label htmlFor="fechaDesde">Fecha desde</label>
            <input
              type="date"
              id="fechaDesde"
              name="fechaDesde"
              value={filtros.fechaDesde}
              onChange={handleFilterChange}
              className={styles.dateInput}
            />
          </div>
          
          <div className={styles.filterGroup}>
            <label htmlFor="fechaHasta">Fecha hasta</label>
            <input
              type="date"
              id="fechaHasta"
              name="fechaHasta"
              value={filtros.fechaHasta}
              onChange={handleFilterChange}
              className={styles.dateInput}
            />
          </div>
          
          {(filtros.accion || filtros.documento || filtros.fechaDesde || filtros.fechaHasta) && (
            <div className={styles.filterActions}>
              <button onClick={resetFilters} className={styles.clearButton}>
                <span className={styles.buttonIcon}>🗑️</span>
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Logs Section */}
      <div className={styles.logsSection}>
        <div className={styles.logsHeader}>
          <div className={styles.logsInfo}>
            <h3>Actividad Reciente</h3>
            <p className={styles.logsCount}>
              {logsFiltrados.length === 0 && logs.length > 0 
                ? 'No se encontraron registros con los filtros aplicados'
                : `${logsFiltrados.length} ${logsFiltrados.length === 1 ? 'registro encontrado' : 'registros encontrados'}`
              }
            </p>
          </div>
        </div>

        {logsFiltrados.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📝</div>
            <h3>
              {logs.length === 0 
                ? 'No hay actividad registrada'
                : 'No se encontraron registros'
              }
            </h3>
            <p>
              {logs.length === 0 
                ? 'Cuando se realicen operaciones en el sistema aparecerán aquí'
                : 'Intenta ajustar los filtros para encontrar lo que buscas'
              }
            </p>
          </div>
        ) : (
          <div className={styles.logsContainer}>
            <div className={styles.logsScrollArea}>
              {logsFiltrados.map((log) => {
                const actionInfo = getActionInfo(log.accion);
                return (
                  <div key={log.id} className={`${styles.logCard} ${styles[`log${actionInfo.color}`]}`}>
                    <div className={styles.logHeader}>
                      <div className={styles.logIcon}>
                        {actionInfo.icon}
                      </div>
                      <div className={styles.logMainInfo}>
                        <h4 className={styles.logAction}>{log.accion}</h4>
                        <p className={styles.logTime}>
                          <span className={styles.timeIcon}>🕒</span>
                          {formatTimeAgo(log.fecha)} • {log.fecha}
                        </p>
                      </div>
                      <div className={styles.logBadge}>
                        <span className={`${styles.actionBadge} ${styles[`badge${actionInfo.color}`]}`}>
                          {actionInfo.label}
                        </span>
                      </div>
                    </div>
                    
                    <div className={styles.logDetails}>
                      <p className={styles.logDescription}>
                        {log.detalles}
                      </p>
                    </div>
                  </div>
                );
              })}
              
              {logsFiltrados.length > 8 && (
                <div className={styles.scrollHint}>
                  <span className={styles.scrollIcon}>⬇️</span>
                  Desliza para ver más registros
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsultarLogs;