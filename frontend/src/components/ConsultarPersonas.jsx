import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../config/axiosConfig';
import { formatDate } from '../utils/dateUtils';
import styles from './ConsultarPersonas.module.css';

const ConsultarPersonas = () => {
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtros, setFiltros] = useState({
    genero: '',
    busqueda: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/personas');
      setPersonas(res.data);
      setError(null);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      setError('Error al cargar datos. Por favor, intente de nuevo más tarde.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, nombre) => {
    if (window.confirm(`¿Está seguro que desea eliminar a ${nombre}?`)) {
      try {
        await api.delete(`/personas/${id}`);
        // Actualizar la lista sin necesidad de recargar todos los datos
        setPersonas(personas.filter(p => p.id !== id));
      } catch (error) {
        console.error('Error al eliminar:', error);
        alert('Error al eliminar persona');
      }
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFiltros({ ...filtros, [name]: value });
  };

  const resetFilters = () => {
    setFiltros({ genero: '', busqueda: '' });
  };

  // Filtrar personas según los criterios
  const personasFiltradas = personas.filter(persona => {
    // Filtro por género
    if (filtros.genero && persona.genero !== filtros.genero) {
      return false;
    }
    
    // Filtro por búsqueda (nombre o apellido)
    if (filtros.busqueda) {
      const searchTerm = filtros.busqueda.toLowerCase();
      const fullName = `${persona.primerNombre} ${persona.segundoNombre || ''} ${persona.apellidos}`.toLowerCase();
      if (!fullName.includes(searchTerm)) {
        return false;
      }
    }
    
    return true;
  });

  // Construir el nombre completo
  const getNombreCompleto = (persona) => {
    return `${persona.primerNombre} ${persona.segundoNombre || ''} ${persona.apellidos}`.trim().replace(/\s+/g, ' ');
  };

  return (
    <div className="card">
      <h2>Personas Registradas</h2>
      
      <div className={styles.actions}>
        <Link to="/" className={styles.createButton}>
          <i className="icon icon-add"></i> Crear Nueva Persona
        </Link>
      </div>
      
      {error && <div className={styles.error}>{error}</div>}
      
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label htmlFor="busqueda">Buscar:</label>
          <input
            type="text"
            id="busqueda"
            name="busqueda"
            value={filtros.busqueda}
            onChange={handleFilterChange}
            placeholder="Nombre o apellido"
            className={styles.searchInput}
          />
        </div>
        
        <div className={styles.filterGroup}>
          <label htmlFor="genero">Género:</label>
          <select
            id="genero"
            name="genero"
            value={filtros.genero}
            onChange={handleFilterChange}
            className={styles.selectFilter}
          >
            <option value="">Todos</option>
            <option value="Masculino">Masculino</option>
            <option value="Femenino">Femenino</option>
            <option value="No binario">No binario</option>
            <option value="Prefiero no reportar">Prefiero no reportar</option>
          </select>
        </div>
        
        {(filtros.genero || filtros.busqueda) && (
          <button onClick={resetFilters} className={styles.resetButton}>
            Limpiar filtros
          </button>
        )}
      </div>
      
      {loading ? (
        <div className={styles.loading}>Cargando datos...</div>
      ) : personasFiltradas.length === 0 ? (
        <div className={styles.noData}>
          {filtros.genero || filtros.busqueda ? 
            "No se encontraron personas con los filtros seleccionados" : 
            "No hay personas registradas todavía"}
        </div>
      ) : (
        <div className={styles.tableResponsive}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Apellidos</th>
                <th>Fecha Nac.</th>
                <th>Género</th>
                <th>Correo</th>
                <th>Celular</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {personasFiltradas.map((persona) => (
                <tr key={persona.id}>
                  <td>{`${persona.primerNombre} ${persona.segundoNombre || ''}`}</td>
                  <td>{persona.apellidos}</td>
                  <td>{formatDate(persona.fechaNacimiento)}</td>
                  <td>{persona.genero}</td>
                  <td>
                    <a href={`mailto:${persona.correo}`} className={styles.email}>
                      {persona.correo}
                    </a>
                  </td>
                  <td>{persona.celular}</td>
                  <td className={styles.actions}>
                    <Link to={`/editar/${persona.id}`} className={styles.editButton}>
                      Editar
                    </Link>
                    <button 
                      onClick={() => handleDelete(persona.id, getNombreCompleto(persona))} 
                      className={styles.deleteButton}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      <div className={styles.summary}>
        <p>Total: {personasFiltradas.length} {personasFiltradas.length === 1 ? 'persona' : 'personas'}</p>
      </div>
    </div>
  );
};

export default ConsultarPersonas;