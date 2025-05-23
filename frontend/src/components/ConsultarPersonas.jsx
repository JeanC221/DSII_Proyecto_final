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
    if (filtros.genero && persona.genero !== filtros.genero) {
      return false;
    }
    
    if (filtros.busqueda) {
      const searchTerm = filtros.busqueda.toLowerCase();
      const fullName = `${persona.primerNombre} ${persona.segundoNombre || ''} ${persona.apellidos}`.toLowerCase();
      const documento = persona.nroDocumento?.toLowerCase() || '';
      if (!fullName.includes(searchTerm) && !documento.includes(searchTerm)) {
        return false;
      }
    }
    
    return true;
  });

  const getNombreCompleto = (persona) => {
    return `${persona.primerNombre} ${persona.segundoNombre || ''} ${persona.apellidos}`.trim().replace(/\s+/g, ' ');
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner}></div>
          <h3>Cargando personas...</h3>
          <p>Obteniendo datos del sistema</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header Section */}
      <div className={styles.headerSection}>
        <div className={styles.titleContainer}>
          <h2>
            <span className={styles.titleIcon}>👥</span>
            Personas Registradas
          </h2>
          <p className={styles.subtitle}>
            Gestiona y visualiza todas las personas registradas en el sistema
          </p>
        </div>
        
        <Link to="/" className={styles.primaryButton}>
          <span className={styles.buttonIcon}>➕</span>
          Nueva Persona
        </Link>
      </div>

      {error && (
        <div className={styles.errorAlert}>
          <span className={styles.alertIcon}>⚠️</span>
          <div>
            <strong>Error al cargar datos</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

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
            <label htmlFor="busqueda">Buscar por nombre o documento</label>
            <input
              type="text"
              id="busqueda"
              name="busqueda"
              value={filtros.busqueda}
              onChange={handleFilterChange}
              placeholder="Ej: María García o 12345678"
              className={styles.searchInput}
            />
          </div>
          
          <div className={styles.filterGroup}>
            <label htmlFor="genero">Filtrar por género</label>
            <select
              id="genero"
              name="genero"
              value={filtros.genero}
              onChange={handleFilterChange}
              className={styles.selectFilter}
            >
              <option value="">Todos los géneros</option>
              <option value="Masculino">Masculino</option>
              <option value="Femenino">Femenino</option>
              <option value="No binario">No binario</option>
              <option value="Prefiero no reportar">Prefiero no reportar</option>
            </select>
          </div>
          
          {(filtros.genero || filtros.busqueda) && (
            <div className={styles.filterActions}>
              <button onClick={resetFilters} className={styles.clearButton}>
                <span className={styles.buttonIcon}>🗑️</span>
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Results Section */}
      <div className={styles.resultsSection}>
        <div className={styles.resultsHeader}>
          <div className={styles.resultsInfo}>
            <h3>Resultados</h3>
            <p className={styles.resultsCount}>
              {personasFiltradas.length === 0 && personas.length > 0 
                ? 'No se encontraron personas con los filtros aplicados'
                : `${personasFiltradas.length} ${personasFiltradas.length === 1 ? 'persona encontrada' : 'personas encontradas'}`
              }
            </p>
          </div>
        </div>

        {personasFiltradas.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>👤</div>
            <h3>
              {personas.length === 0 
                ? 'No hay personas registradas'
                : 'No se encontraron resultados'
              }
            </h3>
            <p>
              {personas.length === 0 
                ? 'Comienza registrando la primera persona en el sistema'
                : 'Intenta ajustar los filtros para encontrar lo que buscas'
              }
            </p>
            {personas.length === 0 && (
              <Link to="/" className={styles.primaryButton}>
                <span className={styles.buttonIcon}>➕</span>
                Registrar Primera Persona
              </Link>
            )}
          </div>
        ) : (
          <div className={styles.personasGrid}>
            {personasFiltradas.map((persona) => (
              <div key={persona.id} className={styles.personCard}>
                <div className={styles.personHeader}>
                  <div className={styles.personAvatar}>
                    {persona.primerNombre.charAt(0)}{persona.apellidos.charAt(0)}
                  </div>
                  <div className={styles.personInfo}>
                    <h4 className={styles.personName}>
                      {getNombreCompleto(persona)}
                    </h4>
                    <p className={styles.personDoc}>
                      {persona.tipoDocumento} • {persona.nroDocumento}
                    </p>
                  </div>
                </div>

                <div className={styles.personDetails}>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>📅 Nacimiento:</span>
                    <span className={styles.detailValue}>
                      {formatDate(persona.fechaNacimiento)}
                    </span>
                  </div>
                  
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>⚧ Género:</span>
                    <span className={styles.detailValue}>{persona.genero}</span>
                  </div>
                  
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>✉️ Correo:</span>
                    <a 
                      href={`mailto:${persona.correo}`} 
                      className={styles.emailLink}
                    >
                      {persona.correo}
                    </a>
                  </div>
                  
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>📱 Celular:</span>
                    <a 
                      href={`tel:${persona.celular}`}
                      className={styles.phoneLink}
                    >
                      {persona.celular}
                    </a>
                  </div>
                </div>

                <div className={styles.personActions}>
                  <Link 
                    to={`/editar/${persona.id}`} 
                    className={styles.editButton}
                  >
                    <span className={styles.buttonIcon}>✏️</span>
                    Editar
                  </Link>
                  <button 
                    onClick={() => handleDelete(persona.id, getNombreCompleto(persona))} 
                    className={styles.deleteButton}
                  >
                    <span className={styles.buttonIcon}>🗑️</span>
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsultarPersonas;