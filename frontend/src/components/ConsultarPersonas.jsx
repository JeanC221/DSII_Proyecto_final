import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../config/axiosConfig';
import styles from './ConsultarPersonas.module.css';

const ConsultarPersonas = () => {
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/api/personas');
        setPersonas(res.data);
        setLoading(false);
      } catch (error) {
        console.error('Error al cargar datos:', error);
        alert('Error al cargar datos');
      }
    };
    fetchData();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm('¿Borrar esta persona?')) {
      try {
        await api.delete(`/api/personas/${id}`);
        setPersonas(personas.filter(p => p.id !== id));
      } catch (error) {
        console.error('Error al eliminar:', error);
        alert('Error al eliminar');
      }
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    // Verificar si es un objeto de Firestore
    if (timestamp.seconds) {
      const date = new Date(timestamp.seconds * 1000);
      return date.toLocaleDateString();
    }
    // Si es una fecha normal
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className={styles.container}>
      <h2>Personas Registradas</h2>
      <Link to="/" className={styles.link}>Crear Nueva Persona</Link>
      {loading ? (
        <p>Cargando...</p>
      ) : personas.length === 0 ? (
        <p>No hay personas registradas todavía</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Apellidos</th>
              <th>Fecha Nac.</th>
              <th>Correo</th>
              <th>Celular</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {personas.map((persona) => (
              <tr key={persona.id}>
                <td>{persona.primerNombre} {persona.segundoNombre || ''}</td>
                <td>{persona.apellidos}</td>
                <td>{formatDate(persona.fechaNacimiento)}</td>
                <td>{persona.correo}</td>
                <td>{persona.celular}</td>
                <td>
                  <Link to={`/editar/${persona.id}`} className={styles.button}>Editar</Link>
                  <button onClick={() => handleDelete(persona.id)} className={styles.deleteButton}>Borrar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ConsultarPersonas;