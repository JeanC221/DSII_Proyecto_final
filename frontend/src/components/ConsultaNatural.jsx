import React, { useState, useEffect, useCallback } from 'react';
import api from '../config/axiosConfig';
import styles from './ConsultaNatural.module.css';

const ConsultaNatural = () => {
  const [consulta, setConsulta] = useState('');
  const [respuesta, setRespuesta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [serviceStatus, setServiceStatus] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);

  useEffect(() => {
    checkServiceStatus();
    const interval = setInterval(checkServiceStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkServiceStatus = useCallback(async () => {
    try {
      console.log('🔍 Verificando estado del servicio RAG...');
      
      const res = await api.get('/health/rag', {
        timeout: 15000
      });
      
      console.log('✅ Estado RAG recibido:', res.data);
      setServiceStatus(res.data);
      setError(null);
      
    } catch (err) {
      console.error('❌ Error al verificar estado del servicio RAG:', err);
      
      try {
        const debugRes = await api.get('/health/debug');
        setDebugInfo(debugRes.data);
      } catch (debugErr) {
        console.error('Error obteniendo debug info:', debugErr);
      }
      
      setServiceStatus({ 
        status: 'error', 
        message: 'No se pudo conectar con el servicio RAG',
        firebase: 'unknown',
        llm_model: 'not available',
        data_retriever: 'unavailable',
        error_details: {
          message: err.message,
          code: err.code
        }
      });
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!consulta.trim()) {
      setError('Por favor, escribe una pregunta');
      return;
    }
    
    if (serviceStatus?.status === 'error') {
      setError('El servicio RAG no está disponible. Intenta más tarde.');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('📤 Enviando consulta:', consulta.trim());
      
      const res = await api.post('/consulta-natural', { 
        consulta: consulta.trim() 
      }, {
        timeout: 30000 
      });
      
      console.log('📥 Respuesta recibida:', res.data);
      
      if (res.data && res.data.answer) {
        setRespuesta(res.data.answer);
      } else {
        setRespuesta('No se pudo obtener una respuesta. Por favor intenta con otra pregunta.');
      }
      
      checkServiceStatus();
      
    } catch (err) {
      console.error('❌ Error al hacer consulta:', err);
      
      if (err.code === 'ECONNABORTED') {
        setError('La consulta tardó demasiado tiempo. El servicio puede estar sobrecargado.');
      } else if (err.response?.status === 400) {
        setError('Consulta inválida. Por favor, reformula tu pregunta.');
      } else if (err.response?.status >= 500) {
        setError('Error del servidor. El servicio RAG puede estar temporalmente no disponible.');
      } else {
        setError('Ocurrió un error al procesar tu consulta. Intenta de nuevo más tarde.');
      }
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
    "¿Cuántos hombres hay registrados?",
    "¿Cuántas personas nacieron en abril?",
    "¿Cuántos adultos jóvenes están registrados?"
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

  const retryConnection = () => {
    setServiceStatus(null);
    checkServiceStatus();
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
            {serviceStatus.status !== 'ok' && (
              <button onClick={retryConnection} className="secondary" style={{marginLeft: '10px', padding: '4px 8px', fontSize: '12px'}}>
                Reintentar
              </button>
            )}
          </div>
          
          <div className={styles.serviceDetails}>
            <small>
              • Firebase: {serviceStatus.firebase === 'connected' ? '✅ Conectado' : '❌ Desconectado'}<br/>
              • Modelo LLM: {serviceStatus.llm_model === 'loaded' ? '✅ Cargado' : '❌ No disponible'}<br/>
              • Recuperador de datos: {serviceStatus.data_retriever === 'available' ? '✅ Disponible' : '❌ No disponible'}
              {serviceStatus.model_info?.llm_provider && (
                <>
                  <br/>• Proveedor: {serviceStatus.model_info.llm_provider} ({serviceStatus.model_info.model})
                </>
              )}
            </small>
          </div>
          
          {/* Información de debug cuando hay errores */}
          {serviceStatus.status === 'error' && debugInfo && (
            <details style={{marginTop: '10px'}}>
              <summary style={{cursor: 'pointer', fontSize: '12px'}}>📋 Información de diagnóstico</summary>
              <pre style={{fontSize: '10px', marginTop: '5px', padding: '5px', backgroundColor: '#f0f0f0', borderRadius: '3px'}}>
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </details>
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
          <h4>🚻 Por género y edad:</h4>
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
              disabled={loading}
            />
            <button 
              type="submit" 
              disabled={loading || !consulta.trim() || serviceStatus?.status === 'error'}
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
                <small>Esto puede tomar hasta 30 segundos para consultas complejas</small>
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