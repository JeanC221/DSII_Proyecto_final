import React, { useState } from 'react';
import axios from 'axios';
import styles from './ConsultaNatural.module.css';

const ConsultaNatural = () => {
  const [consulta, setConsulta] = useState('');
  const [respuesta, setRespuesta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!consulta.trim()) {
      setError('Por favor, escribe una pregunta');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await axios.post('/api/consulta-natural', { consulta });
      setRespuesta(res.data.answer);
    } catch (err) {
      console.error('Error al hacer consulta:', err);
      setError('Ocurrió un error al procesar tu consulta. Intenta de nuevo más tarde.');
    } finally {
      setLoading(false);
    }
  };

  // Ejemplos predefinidos de consultas
  const ejemplos = [
    "¿Cuál es el empleado más joven que se ha registrado?",
    "¿Cuántas personas de género femenino están registradas?",
    "¿Cuál es el promedio de edad de las personas registradas?",
    "¿Quién fue la última persona registrada?"
  ];

  const usarEjemplo = (ejemplo) => {
    setConsulta(ejemplo);
  };

  return (
    <div className="card">
      <h2>CONSULTA EN LENGUAJE NATURAL</h2>
      <p className={styles.description}>
        Utiliza lenguaje natural para consultar información sobre las personas registradas.
        El sistema utilizará RAG (Retrieval Augmented Generation) para procesar tu consulta.
      </p>
      
      <div className={styles.ejemplos}>
        <h3>Ejemplos de consultas:</h3>
        <ul>
          {ejemplos.map((ejemplo, index) => (
            <li key={index}>
              <button onClick={() => usarEjemplo(ejemplo)} className="secondary">Usar</button>
              <span>{ejemplo}</span>
            </li>
          ))}
        </ul>
      </div>
      
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.inputContainer}>
          <label htmlFor="consulta">Pregunta:</label>
          <div className={styles.inputWrapper}>
            <input
              id="consulta"
              type="text"
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              placeholder="Escribe tu pregunta en lenguaje natural"
            />
            <button 
              type="submit" 
              disabled={loading}
            >
              {loading ? 'Consultando...' : 'Consultar'}
            </button>
          </div>
        </div>
        
        {error && <div className="error">{error}</div>}
        
        <div className={styles.resultContainer}>
          <label>Respuesta:</label>
          <div className={styles.result}>
            {loading ? (
              <div className={styles.loading}>Procesando consulta...</div>
            ) : respuesta ? (
              <div className={styles.respuesta}>{respuesta}</div>
            ) : (
              <div className={styles.placeholder}>La respuesta aparecerá aquí</div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

export default ConsultaNatural;