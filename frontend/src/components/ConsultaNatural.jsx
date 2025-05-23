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
        llm_model: 'not loaded',
        data_retriever: 'unavailable'
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
    "¿Cuántas personas están registradas en total?",
    "¿Cuál es la distribución por género?", 
    "¿Cuál es el promedio de edad de las personas registradas?",
    "¿Quién es la persona más joven registrada?",
    "¿Quién fue la última persona en registrarse?",
    "¿Quién es la persona mayor registrada?",
    "¿Cuántas mujeres hay registradas?",
    "¿Cuántos hombres hay registrados?"
  ];

  const usarEjemplo = (ejemplo) => {
    setConsulta(ejemplo);
  };

  const getStatusIcon = (status) => {
    switch(status?.status) {
      case 'ok': return '🟢';
      case 'degraded': return '🟡';
      case 'error': 
      case 'down': 
      default: return '🔴';
    }
  };

  const getStatusText = (status) => {
    if (!status) return 'Verificando...';
    
    switch(status.status) {
      case 'ok': return 'Sistema RAG operativo';
      case 'degraded': return 'Sistema parcialmente disponible';
      case 'error':
      case 'down':
      default: return 'Sistema no disponible';
    }
  };

  return (
    <div className="card">
      <h2>Consulta en Lenguaje Natural</h2>
      
      {/* Indicador de estado mejorado */}
      {serviceStatus && (
        <div className={`${styles.serviceStatus} ${serviceStatus.status === 'ok' ? styles.serviceOk : styles.serviceError}`}>
          <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
            <span>{getStatusIcon(serviceStatus)}</span>
            <strong>{getStatusText(serviceStatus)}</strong>
          </div>
          
          {serviceStatus.status !== 'ok' && (
            <div className={styles.serviceDetails}>
              <small>
                • Firebase: {serviceStatus.firebase === 'connected' ? '✅ Conectado' : '❌ Desconectado'}<br/>
                • Modelo LLM: {serviceStatus.llm_model === 'loaded' ? '✅ Cargado' : '❌ No disponible'}<br/>
                • Recuperador de datos: {serviceStatus.data_retriever === 'available' ? '✅ Disponible' : '❌ No disponible'}
              </small>
            </div>
          )}
        </div>
      )}
      
      <p className={styles.description}>
        Utiliza lenguaje natural para consultar información sobre las personas registradas.
        El sistema analiza tu pregunta y busca en la base de datos real para darte respuestas precisas.
        <br/><br/>
        <strong>Nota:</strong> Las respuestas se basan únicamente en los datos reales almacenados en la base de datos.
      </p>
      
      {/* Ejemplos organizados por categorías */}
      <div className={styles.ejemplos}>
        <h3>Ejemplos de consultas (basadas en datos reales):</h3>
        
        <div className={styles.ejemplosCategoria}>
          <h4>📊 Estadísticas generales:</h4>
          <ul>
            {ejemplos.slice(0, 3).map((ejemplo, index) => (
              <li key={index}>
                <button onClick={() => usarEjemplo(ejemplo)} className="secondary">Usar</button>
                <span>{ejemplo}</span>
              </li>
            ))}
          </ul>
        </div>
        
        <div className={styles.ejemplosCategoria}>
          <h4>👤 Consultas específicas:</h4>
          <ul>
            {ejemplos.slice(3, 6).map((ejemplo, index) => (
              <li key={index + 3}>
                <button onClick={() => usarEjemplo(ejemplo)} className="secondary">Usar</button>
                <span>{ejemplo}</span>
              </li>
            ))}
          </ul>
        </div>
        
        <div className={styles.ejemplosCategoria}>
          <h4>🚻 Por género:</h4>
          <ul>
            {ejemplos.slice(6).map((ejemplo, index) => (
              <li key={index + 6}>
                <button onClick={() => usarEjemplo(ejemplo)} className="secondary">Usar</button>
                <span>{ejemplo}</span>
              </li>
            ))}
          </ul>
        </div>
        
        <div className={styles.ejemplosInfo}>
          <p><strong>💡 Tip:</strong> También puedes preguntar por números de documento específicos o nombres de personas.</p>
          <p><em>Ejemplo:</em> "¿Quién tiene el documento 1234567890?" o "Buscar persona llamada María"</p>
        </div>
      </div>
      
      {/* Formulario de consulta */}
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.inputContainer}>
          <label htmlFor="consulta">Tu pregunta:</label>
          <div className={styles.inputWrapper}>
            <input
              id="consulta"
              type="text"
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              placeholder="Escribe tu pregunta sobre las personas registradas..."
            />
            <button 
              type="submit" 
              disabled={loading || !consulta.trim()}
            >
              {loading ? 'Analizando...' : 'Consultar'}
            </button>
          </div>
        </div>
        
        {error && <div className="error">{error}</div>}
        
        {/* Área de respuesta mejorada */}
        <div className={styles.resultContainer}>
          <label>Respuesta del sistema:</label>
          <div className={styles.result}>
            {loading ? (
              <div className={styles.loading}>
                <div className={styles.loadingSpinner}></div>
                Analizando tu consulta y buscando en los datos...
              </div>
            ) : respuesta ? (
              <div className={styles.respuesta}>
                <div className={styles.respuestaContent}>
                  {respuesta}
                </div>
                <div className={styles.respuestaFooter}>
                  <small>Respuesta basada en datos reales del sistema • {new Date().toLocaleTimeString()}</small>
                </div>
              </div>
            ) : (
              <div className={styles.placeholder}>
                <div className={styles.placeholderIcon}>💬</div>
                <p>Tu respuesta aparecerá aquí</p>
                <small>Utiliza los ejemplos de arriba o escribe tu propia pregunta</small>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

export default ConsultaNatural;