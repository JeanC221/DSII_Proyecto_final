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
    if (!status) return 'Verificando estado del sistema...';
    
    switch(status.status) {
      case 'ok': return 'Sistema RAG operativo y listo';
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

  const clearQuery = () => {
    setConsulta('');
    setRespuesta(null);
    setError(null);
  };

  return (
    <div className={styles.container}>
      {/* Header Section */}
      <div className={styles.headerSection}>
        <div className={styles.titleContainer}>
          <h2>
            <span className={styles.titleIcon}>🤖</span>
            Consulta en Lenguaje Natural
          </h2>
          <p className={styles.subtitle}>
            Utiliza inteligencia artificial para consultar información con lenguaje cotidiano
          </p>
        </div>
        
        <button 
          onClick={retryConnection} 
          className={styles.refreshButton}
          disabled={loading}
        >
          <span className={styles.buttonIcon}>🔄</span>
          Verificar Estado
        </button>
      </div>

      {/* Service Status Card */}
      <div className={`${styles.statusCard} ${serviceStatus?.status === 'ok' ? styles.statusOk : styles.statusError}`}>
        <div className={styles.statusHeader}>
          <div className={styles.statusMain}>
            <span className={styles.statusIcon}>{getStatusIcon(serviceStatus)}</span>
            <div className={styles.statusText}>
              <h3>{getStatusText(serviceStatus)}</h3>
              <p>Estado del servicio de inteligencia artificial</p>
            </div>
          </div>
          
          {serviceStatus?.status !== 'ok' && (
            <button onClick={retryConnection} className={styles.retryButton}>
              <span className={styles.buttonIcon}>🔄</span>
              Reintentar
            </button>
          )}
        </div>
        
        {serviceStatus && (
          <div className={styles.statusDetails}>
            <div className={styles.statusGrid}>
              <div className={styles.statusItem}>
                <span className={styles.statusLabel}>Base de datos:</span>
                <span className={`${styles.statusValue} ${serviceStatus.firebase === 'connected' ? styles.statusActive : styles.statusInactive}`}>
                  {serviceStatus.firebase === 'connected' ? '✅ Conectada' : '❌ Desconectada'}
                </span>
              </div>
              <div className={styles.statusItem}>
                <span className={styles.statusLabel}>Modelo IA:</span>
                <span className={`${styles.statusValue} ${serviceStatus.llm_model === 'loaded' ? styles.statusActive : styles.statusInactive}`}>
                  {serviceStatus.llm_model === 'loaded' ? '✅ Cargado' : '❌ No disponible'}
                </span>
              </div>
              <div className={styles.statusItem}>
                <span className={styles.statusLabel}>Recuperador:</span>
                <span className={`${styles.statusValue} ${serviceStatus.data_retriever === 'available' ? styles.statusActive : styles.statusInactive}`}>
                  {serviceStatus.data_retriever === 'available' ? '✅ Disponible' : '❌ No disponible'}
                </span>
              </div>
              {serviceStatus.model_info?.llm_provider && (
                <div className={styles.statusItem}>
                  <span className={styles.statusLabel}>Proveedor:</span>
                  <span className={styles.statusValue}>
                    {serviceStatus.model_info.llm_provider} ({serviceStatus.model_info.model})
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Description Card */}
      <div className={styles.descriptionCard}>
        <div className={styles.descriptionHeader}>
          <h3>
            <span className={styles.descriptionIcon}>💡</span>
            ¿Cómo funciona?
          </h3>
        </div>
        <div className={styles.descriptionContent}>
          <p>
            <strong>Sistema RAG:</strong> Este sistema combina la búsqueda en datos reales 
            con AI para generar respuestas precisas.
          </p>
          <div className={styles.features}>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>🔍</span>
              <span>Búsqueda en datos reales del sistema</span>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>🧠</span>
              <span>Procesamiento con inteligencia artificial</span>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>📊</span>
              <span>Análisis estadístico automático</span>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>💬</span>
              <span>Respuestas en lenguaje natural</span>
            </div>
          </div>
        </div>
      </div>

      {/* Query Form */}
      <div className={styles.querySection}>
        <div className={styles.queryHeader}>
          <h3>
            <span className={styles.queryIcon}>❓</span>
            Tu Consulta
          </h3>
          <p>Escribe cualquier pregunta sobre los datos registrados en lenguaje natural</p>
        </div>
        
        <form onSubmit={handleSubmit} className={styles.queryForm}>
          <div className={styles.inputContainer}>
            <div className={styles.inputWrapper}>
              <input
                type="text"
                value={consulta}
                onChange={(e) => setConsulta(e.target.value)}
                placeholder="Ejemplo: ¿Cuántas personas hay registradas? ¿Quién es la persona más joven?"
                disabled={loading}
                className={styles.queryInput}
              />
              
              {consulta && (
                <button
                  type="button"
                  onClick={clearQuery}
                  className={styles.clearInputButton}
                  disabled={loading}
                >
                  <span className={styles.buttonIcon}>✕</span>
                </button>
              )}
            </div>
            
            <button 
              type="submit" 
              disabled={loading || !consulta.trim() || serviceStatus?.status === 'error'}
              className={styles.submitButton}
            >
              {loading ? (
                <>
                  <span className={styles.loadingSpinner}></span>
                  Analizando...
                </>
              ) : (
                <>
                  <span className={styles.buttonIcon}>🚀</span>
                  Consultar
                </>
              )}
            </button>
          </div>
          
          {error && (
            <div className={styles.errorAlert}>
              <span className={styles.alertIcon}>⚠️</span>
              <span>{error}</span>
            </div>
          )}
        </form>
      </div>

      {/* Response Section */}
      <div className={styles.responseSection}>
        <div className={styles.responseHeader}>
          <h3>
            <span className={styles.responseIcon}>🤖</span>
            Respuesta del Sistema
          </h3>
        </div>
        
        <div className={styles.responseContainer}>
          {loading ? (
            <div className={styles.loadingState}>
              <div className={styles.loadingSpinner}></div>
              <h4>Analizando tu consulta...</h4>
              <p>El sistema está procesando tu pregunta y buscando en los datos</p>
              <div className={styles.loadingSteps}>
                <div className={styles.loadingStep}>
                  <span className={styles.stepIcon}>🔍</span>
                  <span>Analizando consulta</span>
                </div>
                <div className={styles.loadingStep}>
                  <span className={styles.stepIcon}>📊</span>
                  <span>Buscando en datos</span>
                </div>
                <div className={styles.loadingStep}>
                  <span className={styles.stepIcon}>🧠</span>
                  <span>Generando respuesta</span>
                </div>
              </div>
              <small>Esto puede tomar hasta 30 segundos para consultas complejas</small>
            </div>
          ) : respuesta ? (
            <div className={styles.responseContent}>
              <div className={styles.responseText}>
                {respuesta}
              </div>
              <div className={styles.responseFooter}>
                <div className={styles.responseMetadata}>
                  <span className={styles.responseTime}>
                    <span className={styles.timeIcon}>🕒</span>
                    Respondido el {new Date().toLocaleString('es-ES')}
                  </span>
                  <span className={styles.responseSource}>
                    <span className={styles.sourceIcon}>📊</span>
                    Basado en datos reales del sistema
                  </span>
                </div>
                <button 
                  onClick={clearQuery}
                  className={styles.newQueryButton}
                >
                  <span className={styles.buttonIcon}>➕</span>
                  Nueva Consulta
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.emptyResponse}>
              <div className={styles.emptyIcon}>💬</div>
              <h4>Esperando tu consulta</h4>
              <p>Tu respuesta aparecerá aquí una vez que hagas una pregunta</p>
              <div className={styles.emptyHints}>
                <p>📝 Escribe cualquier pregunta en lenguaje natural</p>
                <p>🔍 Pregunta sobre estadísticas, nombres o documentos</p>
                <p>📊 Solicita análisis demográficos personalizados</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConsultaNatural;