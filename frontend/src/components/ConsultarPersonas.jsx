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
            <span className={styles.titleIcon}>
              <svg className={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </span>
            Personas Registradas
          </h2>
          <p className={styles.subtitle}>
            Gestiona y visualiza todas las personas registradas en el sistema
          </p>
        </div>
        
        <Link to="/" className={styles.primaryButton}>
          <svg className={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Nueva Persona
        </Link>
      </div>

      {error && (
        <div className={styles.errorAlert}>
          <svg className={styles.alertIcon} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
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
            <svg className={styles.filterIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
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
                <svg className={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
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
            <svg className={styles.emptyIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
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
                <svg className={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
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
                    <span className={styles.detailLabel}>
                      <svg className={styles.detailIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a1 1 0 011-1h6a1 1 0 011 1v4M8 7h8M8 7l-1 10a2 2 0 002 2h6a2 2 0 002-2L16 7" />
                      </svg>
                      Nacimiento:
                    </span>
                    <span className={styles.detailValue}>
                      {formatDate(persona.fechaNacimiento)}
                    </span>
                  </div>
                  
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>
                      <svg className={styles.detailIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Género:
                    </span>
                    <span className={styles.detailValue}>{persona.genero}</span>
                  </div>
                  
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>
                      <svg className={styles.detailIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Correo:
                    </span>
                    <a 
                      href={`mailto:${persona.correo}`} 
                      className={styles.emailLink}
                    >
                      {persona.correo}
                    </a>
                  </div>
                  
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>
                      <svg className={styles.detailIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      Celular:
                    </span>
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
                    <svg className={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Editar
                  </Link>
                  <button 
                    onClick={() => handleDelete(persona.id, getNombreCompleto(persona))} 
                    className={styles.deleteButton}
                  >
                    <svg className={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
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