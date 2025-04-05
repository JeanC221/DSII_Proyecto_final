import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import styles from './ConsultarPersonas.module.css';

const ConsultarPersonas = () => {
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get('/api/personas');
        setPersonas(res.data);
        setLoading(false);
      } catch (error) {
        alert('Error al cargar datos');
      }
    };
    fetchData();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm('¿Borrar esta persona?')) {
      try {
        await axios.delete(`/api/personas/${id}`);
        setPersonas(personas.filter(p => p._id !== id));
      } catch (error) {
        alert('Error al eliminar');
      }
    }
  };

  return (
    <div className={styles.container}>
      <h2>Personas Registradas</h2>
      <Link to="/" className={styles.link}>Crear Nueva Persona</Link>
      {loading ? (
        <p>Cargando...</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Celular</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {personas.map((persona) => (
              <tr key={persona._id}>
                <td>{persona.primerNombre} {persona.apellidos}</td>
                <td>{persona.celular}</td>
                <td>
                  <Link to={`/editar/${persona._id}`} className={styles.button}>Editar</Link>
                  <button onClick={() => handleDelete(persona._id)} className={styles.deleteButton}>Borrar</button>
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