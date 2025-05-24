from fastapi import FastAPI, HTTPException, Body
from fastapi.responses import JSONResponse
import os
from datetime import datetime, timedelta
import logging
import time
from typing import Dict, List, Optional, Tuple, Any
import json
import requests
from dataclasses import dataclass, asdict
from enum import Enum

import firebase_admin
from firebase_admin import credentials, firestore, initialize_app

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('/app/logs/rag_system.log', mode='a')
    ]
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Sistema RAG Académico",
    description="Sistema de consultas en lenguaje natural para gestión de datos personales",
    version="1.0.0"
)

# ============================================================================
# CONFIGURACIÓN Y CONEXIONES
# ============================================================================

class SystemStatus(Enum):
    """Estados del sistema"""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    DOWN = "down"

@dataclass
class SystemMetrics:
    """Métricas del sistema para monitoreo académico"""
    total_queries: int = 0
    successful_queries: int = 0
    failed_queries: int = 0
    avg_response_time: float = 0.0
    cache_hit_rate: float = 0.0
    last_updated: datetime = None

class FirebaseManager:
    """Gestor de conexión Firebase con reconexión automática"""
    
    def __init__(self):
        self.db = None
        self.collection = None
        self.logs_collection = None
        self.status = "disconnected"
        self._initialize_connection()
    
    def _initialize_connection(self) -> None:
        try:
            project_id = os.environ.get('FIREBASE_PROJECT_ID', 'proyecto-final-gestordatos')

            # Usar directamente variables de entorno (más seguro)
            cred_dict = {
                "type": "service_account",
                "project_id": project_id,
                "private_key_id": os.environ.get('FIREBASE_PRIVATE_KEY_ID'),
                "private_key": os.environ.get('FIREBASE_PRIVATE_KEY', '').replace('\\n', '\n'),
                "client_email": os.environ.get('FIREBASE_CLIENT_EMAIL'),
                "client_id": os.environ.get('FIREBASE_CLIENT_ID'),
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                "client_x509_cert_url": os.environ.get('FIREBASE_CLIENT_CERT_URL')
            }

            cred = credentials.Certificate(cred_dict)
            firebase_app = initialize_app(cred, {'projectId': project_id})

            self.db = firestore.client()
            self.collection = self.db.collection('personas')
            self.logs_collection = self.db.collection('logs')

            # Test de conexión
            test_query = self.collection.limit(1).get()

            self.status = "connected"
            logger.info("✅ Firebase: Conexión establecida y verificada")

        except Exception as e:
            self.status = "error"
            logger.error(f"❌ Firebase: Error de conexión - {e}")
            raise
    
    def is_healthy(self) -> bool:
        """Verifica salud de la conexión"""
        return self.status == "connected" and self.db is not None

# ============================================================================
# CLIENTE LLM CON GROQ
# ============================================================================

class GroqLLMClient:
    """Cliente optimizado para Groq API con reintentos y métricas"""
    
    def __init__(self):
        self.api_key = os.getenv("GROQ_API_KEY")
        self.base_url = "https://api.groq.com/openai/v1/chat/completions"
        self.model = "llama3-8b-8192"
        self.max_retries = 3
        self.timeout = 30
        self.is_available = False
        
        self._validate_configuration()
        self._test_connectivity()
    
    def _validate_configuration(self) -> None:
        """Valida configuración del cliente"""
        if not self.api_key:
            logger.error("❌ Groq: GROQ_API_KEY no configurada")
            raise ValueError("GROQ_API_KEY requerida")
        
        if not self.api_key.startswith('gsk_'):
            logger.warning("⚠️ Groq: Formato de API key no estándar")
    
    def _test_connectivity(self) -> None:
        """Prueba conectividad con el servicio"""
        try:
            test_response = self._make_request_with_retry(
                "Responde solo 'OK'", 
                max_tokens=5
            )
            
            if test_response and "OK" in test_response.upper():
                self.is_available = True
                logger.info("✅ Groq: Conectividad verificada")
            else:
                logger.warning("⚠️ Groq: Respuesta de prueba inesperada")
                
        except Exception as e:
            logger.error(f"❌ Groq: Error en prueba de conectividad - {e}")
    
    def _make_request_with_retry(self, prompt: str, max_tokens: int = 600) -> Optional[str]:
        """Realiza petición con reintentos automáticos"""
        last_error = None
        
        for attempt in range(self.max_retries):
            try:
                response = self._make_single_request(prompt, max_tokens)
                if response:
                    return response
                    
            except requests.exceptions.RequestException as e:
                last_error = e
                wait_time = 2 ** attempt  
                logger.warning(f"⚠️ Groq: Intento {attempt + 1} falló, reintentando en {wait_time}s")
                time.sleep(wait_time)
            
            except Exception as e:
                logger.error(f"❌ Groq: Error no recuperable - {e}")
                break
        
        logger.error(f"❌ Groq: Todos los reintentos fallaron. Último error: {last_error}")
        return None
    
    def _make_single_request(self, prompt: str, max_tokens: int) -> Optional[str]:
        """Realiza una petición individual a Groq"""
        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": self._get_system_prompt()
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "max_tokens": max_tokens,
            "temperature": 0.1,
            "top_p": 0.9,
            "stream": False
        }
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        response = requests.post(
            self.base_url,
            headers=headers,
            json=payload,
            timeout=self.timeout
        )
        
        if response.status_code == 200:
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()
        else:
            logger.error(f"Groq API Error: {response.status_code} - {response.text}")
            response.raise_for_status()
    
    def _get_system_prompt(self) -> str:
        """Prompt del sistema optimizado para análisis de datos académico"""
        return """Eres un analista de datos experto especializado en consultas académicas sobre bases de datos de personas.

CAPACIDADES REQUERIDAS:
1. Análisis con múltiples filtros simultáneos (género + edad + mes, etc.)
2. Cálculos estadísticos precisos (promedios, distribuciones, rangos)
3. Filtrado temporal (meses de nacimiento, rangos de fechas)
4. Análisis demográfico detallado
5. Respuestas estructuradas y académicamente apropiadas

METODOLOGÍA:
1. Lee CUIDADOSAMENTE la pregunta completa
2. Identifica TODOS los filtros y condiciones
3. Aplica filtros paso a paso sobre los datos proporcionados
4. Cuenta manualmente los registros que cumplan TODOS los criterios
5. Presenta resultados con precisión numérica
6. Incluye análisis contextual cuando sea relevante

FORMATO DE RESPUESTA:
- Respuesta directa al inicio
- Explicación de la metodología aplicada
- Números exactos y porcentajes cuando corresponda
- Contexto adicional si es relevante para comprensión académica

ESTILO: Profesional, preciso, académicamente riguroso."""

# ============================================================================
# GESTOR DE DATOS CON CACHE INTELIGENTE
# ============================================================================

@dataclass
class PersonRecord:
    """Registro estructurado de persona con todos los campos calculados"""
    nombre_completo: str
    primer_nombre: str
    segundo_nombre: str
    apellidos: str
    documento: str
    genero: str
    correo: str
    celular: str
    
    edad: Optional[int] = None
    mes_nacimiento: Optional[int] = None
    mes_nacimiento_nombre: Optional[str] = None
    año_nacimiento: Optional[int] = None
    rango_edad: Optional[str] = None
    es_mayor_edad: Optional[bool] = None
    
    fecha_registro: Optional[datetime] = None

class IntelligentDataManager:
    """Gestor de datos con cache inteligente y procesamiento optimizado"""
    
    def __init__(self, firebase_manager: FirebaseManager):
        self.firebase = firebase_manager
        self.cache = {}
        self.cache_metadata = {}
        self.cache_duration = timedelta(minutes=10)
        
        self.month_names = {
            1: 'enero', 2: 'febrero', 3: 'marzo', 4: 'abril',
            5: 'mayo', 6: 'junio', 7: 'julio', 8: 'agosto',
            9: 'septiembre', 10: 'octubre', 11: 'noviembre', 12: 'diciembre'
        }
        
        self.age_ranges = [
            (0, 17, "Menor de edad"),
            (18, 25, "Joven (18-25)"),
            (26, 35, "Adulto joven (26-35)"),
            (36, 50, "Adulto (36-50)"),
            (51, 65, "Adulto maduro (51-65)"),
            (66, 999, "Adulto mayor (65+)")
        ]
    
    def get_enriched_dataset(self, force_refresh: bool = False) -> List[PersonRecord]:
        """Obtiene dataset enriquecido con cache inteligente"""
        cache_key = "enriched_persons"
        current_time = datetime.now()
        
        if not force_refresh and self._is_cache_valid(cache_key, current_time):
            logger.info("📋 Cache: Utilizando datos en cache")
            return self.cache[cache_key]
        
        logger.info("🔄 Cache: Actualizando desde Firebase")
        fresh_data = self._fetch_and_enrich_data()
        
        self.cache[cache_key] = fresh_data
        self.cache_metadata[cache_key] = current_time
        
        logger.info(f"✅ Dataset: {len(fresh_data)} registros enriquecidos")
        return fresh_data
    
    def _is_cache_valid(self, cache_key: str, current_time: datetime) -> bool:
        """Verifica validez del cache"""
        if cache_key not in self.cache or cache_key not in self.cache_metadata:
            return False
        
        cache_time = self.cache_metadata[cache_key]
        return (current_time - cache_time) < self.cache_duration
    
    def _fetch_and_enrich_data(self) -> List[PersonRecord]:
        """Obtiene y enriquece datos desde Firebase"""
        try:
            if not self.firebase.is_healthy():
                raise ConnectionError("Firebase no disponible")
            
            docs = list(self.firebase.collection.stream())
            enriched_records = []
            current_date = datetime.now()
            
            for doc in docs:
                raw_data = doc.data()
                
                try:
                    record = self._create_basic_record(raw_data)
                    
                    self._enrich_temporal_data(record, raw_data, current_date)
                    self._enrich_demographic_data(record)
                    
                    enriched_records.append(record)
                    
                except Exception as e:
                    logger.warning(f"⚠️ Error procesando registro {doc.id}: {e}")
                    continue
            
            return enriched_records
            
        except Exception as e:
            logger.error(f"❌ Error obteniendo datos: {e}")
            return []
    
    def _create_basic_record(self, raw_data: Dict) -> PersonRecord:
        """Crea registro básico desde datos raw"""
        return PersonRecord(
            nombre_completo=self._build_full_name(raw_data),
            primer_nombre=raw_data.get('primerNombre', '').strip(),
            segundo_nombre=raw_data.get('segundoNombre', '').strip(),
            apellidos=raw_data.get('apellidos', '').strip(),
            documento=raw_data.get('nroDocumento', ''),
            genero=raw_data.get('genero', ''),
            correo=raw_data.get('correo', ''),
            celular=raw_data.get('celular', '')
        )
    
    def _enrich_temporal_data(self, record: PersonRecord, raw_data: Dict, current_date: datetime) -> None:
        """Enriquece con datos temporales calculados"""
        birth_date = raw_data.get('fechaNacimiento')
        if hasattr(birth_date, 'todate'):
            birth_date = birth_date.todate()
            
            record.edad = self._calculate_exact_age(birth_date, current_date)
            record.mes_nacimiento = birth_date.month
            record.mes_nacimiento_nombre = self.month_names.get(birth_date.month, f"mes_{birth_date.month}")
            record.año_nacimiento = birth_date.year
        
        created_at = raw_data.get('createdAt')
        if hasattr(created_at, 'todate'):
            record.fecha_registro = created_at.todate()
    
    def _enrich_demographic_data(self, record: PersonRecord) -> None:
        """Enriquece con datos demográficos"""
        if record.edad is not None:
            record.es_mayor_edad = record.edad >= 18
            record.rango_edad = self._categorize_age(record.edad)
    
    def _calculate_exact_age(self, birth_date: datetime, current_date: datetime) -> int:
        """Calcula edad exacta considerando mes y día"""
        age = current_date.year - birth_date.year
        
        if (current_date.month < birth_date.month or 
            (current_date.month == birth_date.month and current_date.day < birth_date.day)):
            age -= 1
        
        return max(0, age)
    
    def _categorize_age(self, age: int) -> str:
        """Categoriza edad en rangos académicos"""
        for min_age, max_age, category in self.age_ranges:
            if min_age <= age <= max_age:
                return category
        return "Edad no categorizada"
    
    def _build_full_name(self, raw_data: Dict) -> str:
        """Construye nombre completo normalizado"""
        parts = [
            raw_data.get('primerNombre', ''),
            raw_data.get('segundoNombre', ''),
            raw_data.get('apellidos', '')
        ]
        
        clean_parts = [part.strip() for part in parts if part and part.strip()]
        return ' '.join(clean_parts)

# ============================================================================
# PROCESADOR RAG ACADÉMICO
# ============================================================================

class AcademicQueryAnalyzer:
    """Analizador de consultas académicas con clasificación automática"""
    
    def __init__(self):
        self.query_patterns = {
            'simple_count': ['cuántas', 'cuántos', 'total', 'cantidad'],
            'gender_filter': ['hombre', 'mujer', 'masculino', 'femenino', 'género'],
            'age_filter': ['años', 'edad', 'mayor', 'menor', 'joven', 'adulto'],
            'temporal_filter': ['abril', 'mayo', 'enero', 'mes', 'nacido', 'nacieron'],
            'statistical': ['promedio', 'media', 'distribución', 'estadística'],
            'complex_combination': ['y', 'con', 'que sean', 'de más de', 'menores de']
        }
    
    def analyze_complexity(self, query: str) -> Dict[str, Any]:
        query_lower = query.lower()
        
        detected_patterns = []
        for pattern_type, keywords in self.query_patterns.items():
            if any(keyword in query_lower for keyword in keywords):
                detected_patterns.append(pattern_type)
        
        complexity_score = len(detected_patterns)
        
        return {
            'complexity_level': self._get_complexity_level(complexity_score),
            'detected_patterns': detected_patterns,
            'requires_multiple_filters': 'complex_combination' in detected_patterns,
            'is_statistical_query': 'statistical' in detected_patterns
        }
    
    def _get_complexity_level(self, score: int) -> str:
        if score <= 1:
            return "simple"
        elif score <= 3:
            return "moderate"
        else:
            return "complex"

class AcademicRAGProcessor:
    
    def __init__(self, llm_client: GroqLLMClient, data_manager: IntelligentDataManager):
        self.llm = llm_client
        self.data_manager = data_manager
        self.query_analyzer = AcademicQueryAnalyzer()
        self.metrics = SystemMetrics()
    
    def process_academic_query(self, user_query: str) -> Dict[str, Any]:
        start_time = time.time()
        
        try:
            query_analysis = self.query_analyzer.analyze_complexity(user_query)
            logger.info(f"🔍 Consulta analizada: {query_analysis['complexity_level']}")
            
            dataset = self.data_manager.get_enriched_dataset()
            if not dataset:
                return self._create_error_response("No hay datos disponibles")
            
            academic_prompt = self._build_academic_prompt(user_query, dataset, query_analysis)
            
            llm_response = self.llm._make_request_with_retry(academic_prompt, max_tokens=800)
            
            if not llm_response:
                return self._create_error_response("Error en procesamiento LLM")
            
            processing_time = time.time() - start_time
            self._update_metrics(processing_time, success=True)
            
            return {
                "answer": llm_response,
                "metadata": {
                    "query_complexity": query_analysis['complexity_level'],
                    "dataset_size": len(dataset),
                    "processing_time_ms": round(processing_time * 1000, 2),
                    "patterns_detected": query_analysis['detected_patterns']
                }
            }
            
        except Exception as e:
            processing_time = time.time() - start_time
            self._update_metrics(processing_time, success=False)
            logger.error(f"❌ Error procesando consulta: {e}")
            return self._create_error_response(f"Error interno: {str(e)}")
    
    def _build_academic_prompt(self, query: str, dataset: List[PersonRecord], analysis: Dict) -> str:
        dataset_dict = [asdict(record) for record in dataset]
        
        context_stats = self._calculate_context_statistics(dataset)
        
        prompt = f"""SISTEMA DE ANÁLISIS ACADÉMICO DE DATOS DEMOGRÁFICOS

CONJUNTO DE DATOS COMPLETO:
{json.dumps(dataset_dict, default=str, ensure_ascii=False, indent=2)}

ESTADÍSTICAS DE CONTEXTO:
{json.dumps(context_stats, ensure_ascii=False, indent=2)}

ANÁLISIS DE LA CONSULTA:
- Nivel de complejidad: {analysis['complexity_level']}
- Patrones detectados: {', '.join(analysis['detected_patterns'])}
- Requiere múltiples filtros: {'Sí' if analysis['requires_multiple_filters'] else 'No'}

CONSULTA DEL USUARIO: {query}

INSTRUCCIONES ACADÉMICAS:
1. Proporciona una respuesta precisa y académicamente rigurosa
2. Si hay múltiples filtros, aplícalos TODOS secuencialmente
3. Muestra tu metodología de análisis paso a paso
4. Incluye números exactos y porcentajes relevantes
5. Proporciona contexto estadístico cuando sea apropiado
6. Mantén un tono profesional y académico

FORMATO DE RESPUESTA REQUERIDO:
- Respuesta directa al inicio
- Metodología aplicada
- Resultados numéricos precisos
- Análisis contextual (si aplica)

RESPUESTA ACADÉMICA:"""
        
        return prompt
    
    def _calculate_context_statistics(self, dataset: List[PersonRecord]) -> Dict:
        total = len(dataset)
        
        gender_dist = {}
        ages = []
        month_dist = {}
        
        for record in dataset:
            if record.genero:
                gender_dist[record.genero] = gender_dist.get(record.genero, 0) + 1
            
            if record.edad is not None:
                ages.append(record.edad)
            
            if record.mes_nacimiento_nombre:
                month_dist[record.mes_nacimiento_nombre] = month_dist.get(record.mes_nacimiento_nombre, 0) + 1
        
        return {
            "total_registros": total,
            "edad_promedio": round(sum(ages) / len(ages), 1) if ages else 0,
            "rango_edades": f"{min(ages)}-{max(ages)}" if ages else "N/A",
            "distribucion_genero": gender_dist,
            "distribucion_meses": dict(sorted(month_dist.items(), key=lambda x: list(self.data_manager.month_names.values()).index(x[0])))
        }
    
    def _create_error_response(self, error_message: str) -> Dict[str, Any]:
        return {
            "answer": f"Error: {error_message}",
            "metadata": {
                "error": True,
                "timestamp": datetime.now().isoformat()
            }
        }
    
    def _update_metrics(self, processing_time: float, success: bool) -> None:
        self.metrics.total_queries += 1
        
        if success:
            self.metrics.successful_queries += 1
        else:
            self.metrics.failed_queries += 1
        
        current_avg = self.metrics.avg_response_time
        total_queries = self.metrics.total_queries
        self.metrics.avg_response_time = ((current_avg * (total_queries - 1)) + processing_time) / total_queries
        
        self.metrics.last_updated = datetime.now()

# ============================================================================
# INICIALIZACIÓN DEL SISTEMA
# ============================================================================

# Instancias globales del sistema
firebase_manager = FirebaseManager()
groq_client = GroqLLMClient()
data_manager = IntelligentDataManager(firebase_manager)
rag_processor = AcademicRAGProcessor(groq_client, data_manager)

# ============================================================================
# ENDPOINTS DE LA API
# ============================================================================

@app.post("/query", response_model=Dict[str, Any])
async def process_natural_language_query(query: Dict = Body(...)):
    """
    Endpoint principal para consultas en lenguaje natural
    """
    query_text = query.get("query", "").strip()
    
    if not query_text:
        return JSONResponse(
            status_code=400,
            content={"error": "Consulta vacía o inválida"}
        )
    
    logger.info(f"🎓 Consulta académica recibida: {query_text}")
    
    result = rag_processor.process_academic_query(query_text)
    
    if firebase_manager.is_healthy():
        try:
            firebase_manager.logs_collection.add({
                "accion": "Consulta RAG Académica",
                "consulta": query_text,
                "complejidad": result.get("metadata", {}).get("query_complexity", "unknown"),
                "tiempo_procesamiento": result.get("metadata", {}).get("processing_time_ms", 0),
                "timestamp": firestore.SERVER_TIMESTAMP
            })
        except Exception as e:
            logger.warning(f"⚠️ Error logging: {e}")
    
    return result

@app.get("/health", response_model=Dict[str, Any])
async def system_health_check():
    firebase_healthy = firebase_manager.is_healthy()
    groq_healthy = groq_client.is_available
    
    overall_status = SystemStatus.HEALTHY
    if not firebase_healthy or not groq_healthy:
        overall_status = SystemStatus.DEGRADED if firebase_healthy or groq_healthy else SystemStatus.DOWN
    
    return {
        "status": overall_status.value,
        "components": {
            "firebase": "healthy" if firebase_healthy else "unhealthy",
            "groq_llm": "healthy" if groq_healthy else "unhealthy",
            "data_manager": "healthy",
            "rag_processor": "healthy"
        },
        "system_metrics": asdict(rag_processor.metrics),
        "capabilities": [
            "Consultas complejas con múltiples filtros",
            "Análisis temporal y demográfico",
            "Cálculos estadísticos automatizados",
            "Cache inteligente para optimización",
            "Logging académico detallado"
        ],
        "model_info": {
            "llm_provider": "Groq",
            "model": groq_client.model,
            "max_tokens": 800
        },
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0-academic"
    }

@app.get("/metrics", response_model=Dict[str, Any])
async def get_system_metrics():
    return {
        "performance_metrics": asdict(rag_processor.metrics),
        "cache_statistics": {
            "cache_size": len(data_manager.cache),
            "cache_duration_minutes": data_manager.cache_duration.total_seconds() / 60
        },
        "dataset_info": {
            "total_records": len(data_manager.get_enriched_dataset()),
            "last_refresh": data_manager.cache_metadata.get("enriched_persons", "Never").isoformat() if isinstance(data_manager.cache_metadata.get("enriched_persons"), datetime) else "Never"
        }
    }

@app.get("/academic-examples", response_model=Dict[str, List[str]])
async def get_academic_query_examples():
    return {
        "consultas_simples": [
            "¿Cuántas personas están registradas en total?",
            "¿Cuál es la distribución por género?",
            "¿Cuántas mujeres hay registradas?"
        ],
        "consultas_moderadas": [
            "¿Cuántas personas nacieron en abril?",
            "¿Cuál es el promedio de edad por género?",
            "¿Cuántos adultos jóvenes hay registrados?"
        ],
        "consultas_complejas": [
            "¿Cuántos hombres de más de 20 años están registrados?",
            "¿Mujeres menores de 30 años nacidas entre marzo y junio?",
            "¿Cuál es la distribución de edades por género en cada rango etario?"
        ],
        "consultas_estadisticas": [
            "¿Cuál es la correlación entre género y rango de edad?",
            "¿Qué porcentaje de cada género está en edad productiva?",
            "¿Cuál es la distribución temporal de registros por mes de nacimiento y género?"
        ],
        "consultas_avanzadas": [
            "¿Cuántas personas de género no binario mayores de edad nacieron en el primer trimestre?",
            "¿Cuál es la edad promedio de hombres vs mujeres en cada categoría etaria?",
            "¿Qué tendencias demográficas se observan en los registros por año de nacimiento?"
        ]
    }

@app.get("/documentation", response_model=Dict[str, Any])
async def get_system_documentation():
    return {
        "titulo": "Sistema RAG para Análisis Demográfico",
        "descripcion": "Sistema académico de consultas en lenguaje natural con capacidades de RAG real",
        "arquitectura": {
            "componentes": [
                "Firebase Firestore (Base de datos)",
                "Groq API (Modelo de lenguaje)",
                "FastAPI (Framework web)",
                "Sistema de cache inteligente",
                "Analizador de consultas académicas"
            ],
            "flujo_procesamiento": [
                "1. Recepción y análisis de consulta",
                "2. Recuperación de datos con cache",
                "3. Enriquecimiento de dataset",
                "4. Construcción de prompt académico", 
                "5. Procesamiento con LLM",
                "6. Logging y métricas"
            ]
        },
        "capacidades_tecnicas": {
            "tipos_consulta": [
                "Filtros simples (género, edad)",
                "Filtros complejos (múltiples condiciones)", 
                "Análisis temporal (meses, años)",
                "Cálculos estadísticos",
                "Análisis demográfico avanzado"
            ],
            "optimizaciones": [
                "Cache inteligente con TTL",
                "Reintentos automáticos",
                "Enriquecimiento de datos",
                "Análisis de complejidad de consultas"
            ]
        },
        "metricas_academicas": [
            "Tiempo de respuesta promedio",
            "Tasa de éxito de consultas",
            "Efectividad del cache",
            "Distribución de complejidad de consultas"
        ]
    }

@app.post("/evaluate", response_model=Dict[str, Any])
async def evaluate_system_performance():
    test_queries = [
        "¿Cuántas personas hay registradas?",
        "¿Cuántos hombres de más de 25 años?", 
        "¿Mujeres nacidas en abril?",
        "¿Cuál es el promedio de edad por género?"
    ]
    
    evaluation_results = []
    
    for query in test_queries:
        start_time = time.time()
        
        try:
            result = rag_processor.process_academic_query(query)
            processing_time = time.time() - start_time
            
            evaluation_results.append({
                "query": query,
                "success": "error" not in result.get("answer", "").lower(),
                "processing_time_ms": round(processing_time * 1000, 2),
                "complexity": result.get("metadata", {}).get("query_complexity", "unknown"),
                "response_length": len(result.get("answer", ""))
            })
            
        except Exception as e:
            evaluation_results.append({
                "query": query,
                "success": False,
                "error": str(e),
                "processing_time_ms": round((time.time() - start_time) * 1000, 2)
            })
    
    successful_queries = sum(1 for r in evaluation_results if r["success"])
    avg_processing_time = sum(r["processing_time_ms"] for r in evaluation_results) / len(evaluation_results)
    
    return {
        "evaluation_summary": {
            "total_queries": len(test_queries),
            "successful_queries": successful_queries,
            "success_rate": round((successful_queries / len(test_queries)) * 100, 2),
            "average_processing_time_ms": round(avg_processing_time, 2)
        },
        "detailed_results": evaluation_results,
        "system_status": "operational" if successful_queries > len(test_queries) * 0.8 else "degraded"
    }

# ============================================================================
# MIDDLEWARE Y CONFIGURACIÓN ADICIONAL
# ============================================================================

@app.middleware("http")
async def log_requests(request, call_next):
    """Middleware para logging académico de requests"""
    start_time = time.time()
    
    response = await call_next(request)
    
    process_time = time.time() - start_time
    logger.info(f"📊 {request.method} {request.url.path} - {response.status_code} - {process_time:.3f}s")
    
    return response

@app.on_event("startup")
async def startup_event():
    """Evento de inicio del sistema"""
    logger.info("🚀 Sistema RAG Académico iniciando...")
    
    required_env_vars = ["GROQ_API_KEY", "FIREBASE_PROJECT_ID"]
    missing_vars = [var for var in required_env_vars if not os.getenv(var)]
    
    if missing_vars:
        logger.error(f"❌ Variables de entorno faltantes: {missing_vars}")
        raise ValueError(f"Variables requeridas: {missing_vars}")
    
    os.makedirs("/app/logs", exist_ok=True)
    
    logger.info("✅ Sistema RAG Académico iniciado correctamente")

@app.on_event("shutdown") 
async def shutdown_event():
    """Evento de cierre del sistema"""
    logger.info("🛑 Sistema RAG Académico cerrando...")
    
    final_metrics = asdict(rag_processor.metrics)
    logger.info(f"📈 Métricas finales: {final_metrics}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)