import React, { useState, useEffect, useCallback } from 'react';
import api from '../config/axiosConfig';
import styles from './ConsultaNatural.module.css';

const ConsultaNatural = () => {
  const [consulta, setConsulta] = useState('');
  const [respuesta, setRespuesta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [serviceStatus, setServiceStatus] = useState(null);

  useEffect(() => {
    checkServiceStatus();
  }, []);

  const checkServiceStatus = useCallback(async () => {
    try {
      const res = await api.get('/health/rag');
      setServiceStatus(res.data);
    } catch (err) {
      console.error('Error al verificar estado del servicio RAG:', err);
      setServiceStatus({ 
        status: 'error', 
        message: 'No se pudo conectar con el servicio RAG',
        firebase: 'disconnected',
        llm_model: 'not loaded'
      });
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!consulta.trim()) {
      setError('Por favor, escribe una pregunta');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await api.post('/consulta-natural', { 
        consulta: consulta.trim() 
      });
      
      if (res.data && res.data.answer) {
        setRespuesta(res.data.answer);
      } else {
        setRespuesta('No se pudo obtener una respuesta. Por favor intenta con otra pregunta.');
      }
      
      checkServiceStatus();
    } catch (err) {
      console.error('Error al hacer consulta:', err);
      setError('Ocurrió un error al procesar tu consulta. Intenta de nuevo más tarde.');
    } finally {
      setLoading(false);
    }
  };

  const ejemplos = [
    "¿Cuál es la persona más joven que se ha registrado?",
    "¿Cuántas personas de género femenino están registradas?",
    "¿Cuál es el promedio de edad de las personas registradas?",
    "¿Quién fue la última persona registrada?",
    "¿Cuántas personas están registradas en total?"
  ];

  const usarEjemplo = (ejemplo) => {
    setConsulta(ejemplo);
  };

  return (
    <div className="card">
      <h2>Consulta en Lenguaje Natural</h2>
      
      {/* Indicador de estado del servicio RAG */}
      {serviceStatus && (
        <div className={`${styles.serviceStatus} ${serviceStatus.status === 'ok' ? styles.serviceOk : styles.serviceError}`}>
          <strong>Estado del servicio RAG:</strong> {serviceStatus.status === 'ok' ? 'Disponible' : 'No disponible'}
          {serviceStatus.status !== 'ok' && (
            <p className={styles.serviceWarning}>
              Las respuestas serán generadas usando el modo de respaldo y pueden no ser tan precisas.
              {serviceStatus.firebase === 'disconnected' && ' La conexión a Firebase no está disponible.'}
              {serviceStatus.llm_model !== 'loaded' && ' El modelo de lenguaje no está cargado correctamente.'}
            </p>
          )}
        </div>
      )}
      
      <p className={styles.description}>
        Utiliza lenguaje natural para consultar información sobre las personas registradas.
        El sistema utilizará RAG (Retrieval Augmented Generation) para procesar tu consulta
        y generar respuestas basadas en los datos almacenados.
      </p>
      
      {/* Ejemplos de consultas */}
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
      
      {/* Formulario de consulta */}
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
              disabled={loading || !consulta.trim()}
            >
              {loading ? 'Consultando...' : 'Consultar'}
            </button>
          </div>
        </div>
        
        {error && <div className="error">{error}</div>}
        
        {/* Área de respuesta */}
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