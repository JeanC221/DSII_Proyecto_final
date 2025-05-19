import React, { useEffect, useState } from 'react';
import api from '../config/axiosConfig';
import styles from './ConsultarLogs.module.css';

const ConsultarLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtros, setFiltros] = useState({
    accion: '',
    documento: ''
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
    setFiltros({ accion: '', documento: '' });
  };

  const logsFiltrados = logs.filter(log => {
    if (filtros.accion && !log.accion.includes(filtros.accion)) {
      return false;
    }
    
    if (filtros.documento && !log.detalles.toLowerCase().includes(filtros.documento.toLowerCase())) {
      return false;
    }
    
    return true;
  });

  const getActionClass = (accion) => {
    const accionLower = accion.toLowerCase();
    if (accionLower.includes('crear')) return styles.createAction;
    if (accionLower.includes('actualizar')) return styles.updateAction;
    if (accionLower.includes('eliminar')) return styles.deleteAction;
    if (accionLower.includes('consulta natural')) return styles.queryAction;
    return styles.readAction;
  };

  return (
    <div className="card">
      <h2>Registro de Actividades</h2>
      
      <p className={styles.description}>
        Este registro muestra todas las operaciones realizadas en el sistema, ordenadas por fecha (más recientes primero).
      </p>
      
      {/* Filtros para los logs */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label htmlFor="accion">Filtrar por tipo de acción:</label>
          <select
            id="accion"
            name="accion"
            value={filtros.accion}
            onChange={handleFilterChange}
          >
            <option value="">Todas las acciones</option>
            <option value="Crear">Crear</option>
            <option value="Actualizar">Actualizar</option>
            <option value="Eliminar">Eliminar</option>
            <option value="Consultar">Consultar</option>
            <option value="Consulta Natural">Consulta Natural</option>
          </select>
        </div>
        
        <div className={styles.filterGroup}>
          <label htmlFor="documento">Filtrar por documento:</label>
          <input
            type="text"
            id="documento"
            name="documento"
            value={filtros.documento}
            onChange={handleFilterChange}
            placeholder="Número de documento"
          />
        </div>
        
        {(filtros.accion || filtros.documento) && (
          <button onClick={resetFilters} className="secondary">
            Limpiar filtros
          </button>
        )}
      </div>
      
      {error && <div className="error">{error}</div>}
      
      {loading ? (
        <div className={styles.loading}>Cargando registro de actividades...</div>
      ) : logsFiltrados.length === 0 ? (
        <div className={styles.noData}>
          {filtros.accion || filtros.documento ? 
            "No se encontraron registros con los filtros seleccionados" : 
            "No hay actividades registradas todavía"}
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Fecha y Hora</th>
                <th>Acción</th>
                <th>Detalles</th>
              </tr>
            </thead>
            <tbody>
              {logsFiltrados.map((log) => (
                <tr key={log.id} className={getActionClass(log.accion)}>
                  <td>{log.fecha}</td>
                  <td>
                    <span className={styles.actionBadge}>{log.accion}</span>
                  </td>
                  <td>{log.detalles}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ConsultarLogs;