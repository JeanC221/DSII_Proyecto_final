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
import re

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
        return """Eres un asistente especializado en análisis de datos demográficos.

REGLAS FUNDAMENTALES:
1. Responde SOLO lo preguntado, máximo 2 oraciones
2. Usa los datos EXACTOS proporcionados en el prompt
3. Para personas específicas: usa el campo 'nombre_completo'
4. Para fechas: usa 'fecha_registro_texto' o 'mes_nacimiento_texto'
5. Para edad: usa 'edad_anos' (solo si 'tiene_edad' es true)
6. Para cálculos: usa las estadísticas pre-calculadas primero

TIPOS DE CONSULTA Y CÓMO RESPONDER:
- Conteos: "Hay X personas..."
- Última persona: "La última persona registrada es [nombre_completo] el [fecha_registro_texto]"
- Más joven: "La persona más joven es [nombre_completo] con [edad_anos] años"
- Mayor: "La persona mayor es [nombre_completo] con [edad_anos] años"
- Porcentajes: "Masculino X%, Femenino Y%, etc."
- Filtros: Examinar TODOS los registros y aplicar condiciones exactas
- Promedios: Usar estadísticas pre-calculadas o calcular si es necesario

FORMATO DE RESPUESTA:
- Sin explicaciones metodológicas
- Sin palabras como "análisis", "metodología", "académico"
- Datos exactos de los registros
- Nombres completos reales
- Números precisos

Si no hay datos suficientes, responde: "No hay información suficiente para responder esta pregunta"."""

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
            
            # CORRECCIÓN: Usar get() en lugar de stream() para mejor compatibilidad
            snapshot = self.firebase.collection.get()
            enriched_records = []
            current_date = datetime.now()
            
            logger.info(f"📊 Firebase: {len(snapshot)} documentos encontrados")
            
            for doc in snapshot:
                # CORRECCIÓN: Verificar que el documento existe antes de acceder a data()
                if not doc.exists:
                    logger.warning(f"⚠️ Documento {doc.id} no existe")
                    continue
                    
                try:
                    raw_data = doc.to_dict()  # CORRECCIÓN: Usar to_dict() en lugar de data()
                    
                    if not raw_data:
                        logger.warning(f"⚠️ Documento {doc.id} está vacío")
                        continue
                    
                    # Verificar campos obligatorios
                    required_fields = ['primerNombre', 'apellidos', 'nroDocumento']
                    if not all(field in raw_data for field in required_fields):
                        logger.warning(f"⚠️ Documento {doc.id} falta campos obligatorios")
                        continue
                    
                    record = self._create_basic_record(raw_data)
                    
                    self._enrich_temporal_data(record, raw_data, current_date)
                    self._enrich_demographic_data(record)
                    
                    enriched_records.append(record)
                    
                except Exception as e:
                    logger.warning(f"⚠️ Error procesando registro {doc.id}: {e}")
                    continue
            
            logger.info(f"✅ Dataset: {len(enriched_records)} registros enriquecidos correctamente")
            return enriched_records
            
        except Exception as e:
            logger.error(f"❌ Error obteniendo datos de Firebase: {e}")
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

class PrecomputedQueries:
    """Gestor de consultas precomputadas para respuestas rápidas"""
    
    def __init__(self, data_manager: IntelligentDataManager):
        self.data_manager = data_manager
        self.precomputed_answers = {}
        self._build_precomputed_queries()
    
    def _build_precomputed_queries(self):
        """Define las consultas predeterminadas y sus respuestas - VERSIÓN CORREGIDA"""
        self.query_handlers = {
            # Exactamente como aparecen en el frontend
            "¿Cuántas personas están registradas en total?": self._total_personas,
            "¿Cuál es la distribución por género?": self._distribucion_genero,
            "¿Quién es la persona más joven registrada?": self._persona_mas_joven,
            "¿Quién es la persona mayor registrada?": self._persona_mayor,
            "¿Cuántas personas nacieron en abril?": self._nacidos_abril,
            "¿Cuál es el promedio de edad de las personas registradas?": self._promedio_edad,
            "¿Cuántos hombres de más de 25 años hay?": self._hombres_mayor_25,
            "¿Mujeres menores de 30 años nacidas en abril?": self._mujeres_menor_30_abril,
            "¿Quién fue la última persona en registrarse?": self._ultima_persona_registrada,
            "¿Qué porcentaje de cada género está registrado?": self._porcentaje_generos
        }
    
    def is_precomputed_query(self, query: str) -> bool:
        """Verifica si es una consulta predeterminada - MEJORADA CON DEBUG"""
        query_clean = query.strip()
        
        # DEBUG: Mostrar todas las consultas disponibles
        logger.info(f"🔍 DEBUG: Consulta recibida: '{query_clean}'")
        logger.info(f"🔍 DEBUG: Consultas precomputadas disponibles:")
        for i, precomputed_query in enumerate(self.query_handlers.keys()):
            logger.info(f"  {i+1}. '{precomputed_query}'")
        
        # Verificación exacta primero
        if query_clean in self.query_handlers:
            logger.info(f"✅ Consulta precomputada encontrada (exacta): {query_clean}")
            return True
        
        # Verificación sin signos de interrogación (fallback)
        query_without_signs = query_clean.replace('¿', '').replace('?', '').strip()
        logger.info(f"🔍 DEBUG: Consulta sin signos: '{query_without_signs}'")
        
        for precomputed_query in self.query_handlers.keys():
            precomputed_clean = precomputed_query.replace('¿', '').replace('?', '').strip()
            logger.info(f"🔍 DEBUG: Comparando con: '{precomputed_clean}'")
            
            if query_without_signs.lower() == precomputed_clean.lower():
                logger.info(f"✅ Consulta precomputada encontrada (sin signos): {query_clean}")
                return True
        
        logger.info(f"❌ Consulta NO es precomputada: {query_clean}")
        return False
    
    def get_precomputed_answer(self, query: str) -> str:
        """Obtiene respuesta precomputada rápida - MEJORADA"""
        query_clean = query.strip()
        
        # Buscar coincidencia exacta primero
        if query_clean in self.query_handlers:
            handler = self.query_handlers[query_clean]
        else:
            # Buscar coincidencia sin signos
            query_without_signs = query_clean.replace('¿', '').replace('?', '').strip()
            handler = None
            for precomputed_query, precomputed_handler in self.query_handlers.items():
                precomputed_clean = precomputed_query.replace('¿', '').replace('?', '').strip()
                if query_without_signs.lower() == precomputed_clean.lower():
                    handler = precomputed_handler
                    break
            
            if not handler:
                return None
        
        try:
            dataset = self.data_manager.get_enriched_dataset()
            logger.info(f"🚀 Ejecutando consulta precomputada para: {query_clean}")
            result = handler(dataset)
            logger.info(f"✅ Respuesta precomputada generada: {result[:100]}...")
            return result
        except Exception as e:
            logger.error(f"❌ Error en consulta precomputada: {e}")
            return "Error al procesar la consulta predeterminada."

    # Métodos de consultas precomputadas - CORREGIDOS
    def _total_personas(self, dataset: List) -> str:
        total = len(dataset)
        return f"Hay {total} personas registradas en total en el sistema."
    
    def _distribucion_genero(self, dataset: List) -> str:
        generos = {}
        for record in dataset:
            genero = record.genero.lower() if record.genero else "no especificado"
            generos[genero] = generos.get(genero, 0) + 1
        
        resultado = "Distribución por género:\n"
        for genero, cantidad in generos.items():
            resultado += f"• {genero.capitalize()}: {cantidad} personas\n"
        
        return resultado.strip()
    
    def _persona_mas_joven(self, dataset: List) -> str:
        personas_con_edad = [r for r in dataset if r.edad is not None]
        if not personas_con_edad:
            return "No hay información de edad disponible."
        
        mas_joven = min(personas_con_edad, key=lambda r: r.edad)
        return f"La persona más joven registrada es {mas_joven.nombre_completo} con {mas_joven.edad} años."
    
    def _persona_mayor(self, dataset: List) -> str:
        personas_con_edad = [r for r in dataset if r.edad is not None]
        if not personas_con_edad:
            return "No hay información de edad disponible."
        
        mayor = max(personas_con_edad, key=lambda r: r.edad)
        return f"La persona mayor registrada es {mayor.nombre_completo} con {mayor.edad} años."
    
    def _nacidos_abril(self, dataset: List) -> str:
        nacidos_abril = [r for r in dataset if r.mes_nacimiento == 4]
        count = len(nacidos_abril)
        if count == 0:
            return "No hay personas registradas que hayan nacido en abril."
        elif count == 1:
            return "Hay 1 persona que nació en abril."
        else:
            return f"Hay {count} personas que nacieron en abril."
    
    def _promedio_edad(self, dataset: List) -> str:
        personas_con_edad = [r for r in dataset if r.edad is not None]
        if not personas_con_edad:
            return "No hay información de edad disponible para calcular el promedio."
        
        promedio = sum(r.edad for r in personas_con_edad) / len(personas_con_edad)
        return f"El promedio de edad de las personas registradas es {promedio:.1f} años."
    
    def _hombres_mayor_25(self, dataset: List) -> str:
        hombres_mayor_25 = [
            r for r in dataset 
            if r.genero and r.genero.lower() in ["masculino", "hombre", "m"] 
            and r.edad is not None and r.edad > 25
        ]
        count = len(hombres_mayor_25)
        if count == 0:
            return "No hay hombres de más de 25 años registrados."
        elif count == 1:
            return "Hay 1 hombre de más de 25 años registrado."
        else:
            return f"Hay {count} hombres de más de 25 años registrados."
    
    def _mujeres_menor_30_abril(self, dataset: List) -> str:
        mujeres_filtradas = [
            r for r in dataset 
            if r.genero and r.genero.lower() in ["femenino", "mujer", "f"]
            and r.edad is not None and r.edad < 30
            and r.mes_nacimiento == 4
        ]
        count = len(mujeres_filtradas)
        if count == 0:
            return "No hay mujeres menores de 30 años que hayan nacido en abril."
        elif count == 1:
            return "Hay 1 mujer menor de 30 años que nació en abril."
        else:
            return f"Hay {count} mujeres menores de 30 años que nacieron en abril."
    
    def _ultima_persona_registrada(self, dataset: List) -> str:
        personas_con_fecha = [r for r in dataset if r.fecha_registro is not None]
        if not personas_con_fecha:
            return "No hay información de fecha de registro disponible."
        
        ultima = max(personas_con_fecha, key=lambda r: r.fecha_registro)
        fecha_str = ultima.fecha_registro.strftime("%d/%m/%Y")
        return f"La última persona en registrarse fue {ultima.nombre_completo} el {fecha_str}."
    
    def _porcentaje_generos(self, dataset: List) -> str:
        if not dataset:
            return "No hay datos disponibles."
        
        generos = {}
        for record in dataset:
            genero = record.genero.lower() if record.genero else "no especificado"
            generos[genero] = generos.get(genero, 0) + 1
        
        total = len(dataset)
        resultado = "Porcentaje por género:\n"
        
        for genero, cantidad in generos.items():
            porcentaje = (cantidad / total) * 100
            resultado += f"• {genero.capitalize()}: {porcentaje:.1f}% ({cantidad} personas)\n"
        
        return resultado.strip()

class AcademicRAGProcessor:
    
    def __init__(self, llm_client: GroqLLMClient, data_manager: IntelligentDataManager):
        self.llm = llm_client
        self.data_manager = data_manager
        self.query_analyzer = AcademicQueryAnalyzer()
        self.metrics = SystemMetrics()
        self.precomputed = PrecomputedQueries(data_manager)
    
    def process_academic_query(self, user_query: str) -> Dict[str, Any]:
        start_time = time.time()
        
        try:
            logger.info(f"🔍 Procesando consulta: '{user_query}'")
            
            # PRIMERO: Verificar si es una consulta predeterminada
            if self.precomputed.is_precomputed_query(user_query):
                logger.info(f"🚀 Usando respuesta precomputada para: {user_query}")
                
                precomputed_answer = self.precomputed.get_precomputed_answer(user_query)
                processing_time = time.time() - start_time
                
                self._update_metrics(processing_time, success=True)
                
                return {
                    "answer": precomputed_answer,
                    "metadata": {
                        "query_type": "precomputed",
                        "query_complexity": "simple",
                        "dataset_size": len(self.data_manager.get_enriched_dataset()),
                        "processing_time_ms": round(processing_time * 1000, 2),
                        "patterns_detected": ["precomputed_query"],
                        "data_enrichment": "precomputed_fast_response"
                    }
                }
            
            # SEGUNDO: Si no es predeterminada, usar el procesamiento completo con IA
            logger.info(f"🤖 Consulta personalizada detectada, usando IA: {user_query}")
            
            dataset = self.data_manager.get_enriched_dataset()
            logger.info(f"🔍 Dataset cargado: {len(dataset)} registros")

            if not dataset:
                return self._create_error_response("No hay datos disponibles en la base de datos")

            valid_records = [r for r in dataset if r.nombre_completo and r.nombre_completo.strip()]
            if not valid_records:
                return self._create_error_response("No hay registros válidos en la base de datos")

            query_analysis = self.query_analyzer.analyze_complexity(user_query)

            # Filtrar registros relevantes según la consulta
            filtered_records = self._filter_records_by_query(user_query, valid_records, query_analysis)
            if not filtered_records:
                # Si el filtro no encuentra nada, usar todos los válidos
                filtered_records = valid_records

            academic_prompt = self._build_academic_prompt(user_query, filtered_records, query_analysis)

            max_tokens = 150 if query_analysis['complexity_level'] == 'simple' else 250

            llm_response = self.llm._make_request_with_retry(academic_prompt, max_tokens=max_tokens)

            # Fallback lógico si el LLM no responde o da respuesta genérica
            if not llm_response or "no hay información suficiente" in llm_response.lower():
                fallback_answer = self._fallback_answer(user_query, filtered_records, query_analysis)
                if fallback_answer:
                    return {
                        "answer": fallback_answer,
                        "metadata": {
                            "query_type": "custom_fallback",
                            "query_complexity": query_analysis['complexity_level'],
                            "dataset_size": len(filtered_records),
                            "processing_time_ms": round((time.time() - start_time) * 1000, 2),
                            "patterns_detected": query_analysis['detected_patterns'],
                            "data_enrichment": "fallback_logic"
                        }
                    }
                return self._create_error_response("No se pudo obtener una respuesta adecuada.")

            processing_time = time.time() - start_time
            self._update_metrics(processing_time, success=True)

            return {
                "answer": llm_response.strip(),
                "metadata": {
                    "query_type": "custom_ai_powered",
                    "query_complexity": query_analysis['complexity_level'],
                    "dataset_size": len(filtered_records),
                    "processing_time_ms": round(processing_time * 1000, 2),
                    "patterns_detected": query_analysis['detected_patterns'],
                    "data_enrichment": "full_ai_processing"
                }
            }

        except Exception as e:
            processing_time = time.time() - start_time
            self._update_metrics(processing_time, success=False)
            logger.error(f"❌ Error procesando consulta: {e}")
            return self._create_error_response(f"Error procesando la consulta: {str(e)}")

    def _filter_records_by_query(self, query: str, records: list, analysis: dict) -> list:
        """Filtra los registros según la consulta detectada"""
        q = query.lower()
        filtered = records

        # Filtrar por género
        if "hombre" in q or "masculino" in q:
            filtered = [r for r in filtered if r.genero and r.genero.lower() in ["masculino", "hombre", "m"]]
        if "mujer" in q or "femenino" in q:
            filtered = [r for r in filtered if r.genero and r.genero.lower() in ["femenino", "mujer", "f"]]

        # Filtrar por edad - mayor de X años
        if "mayor de" in q or "más de" in q:
            match = re.search(r"(mayor de|más de)\s+(\d+)", q)
            if match:
                edad_limite = int(match.group(2))
                filtered = [r for r in filtered if r.edad is not None and r.edad > edad_limite]
        
        # Filtrar por edad - menor de X años
        if "menor de" in q:
            match = re.search(r"menor de\s+(\d+)", q)
            if match:
                edad_limite = int(match.group(1))
                filtered = [r for r in filtered if r.edad is not None and r.edad < edad_limite]

        # Filtrar por edad - exacta o rango
        if "años" in q and "de" in q:
            # Buscar patrones como "25 años", "de 25 años"
            match = re.search(r"de\s+(\d+)\s+años", q)
            if not match:
                match = re.search(r"(\d+)\s+años", q)
            if match:
                edad_exacta = int(match.group(1))
                # Si no hay "mayor de" o "menor de", buscar edad exacta
                if "mayor" not in q and "menor" not in q and "más" not in q:
                    filtered = [r for r in filtered if r.edad is not None and r.edad == edad_exacta]

        return filtered

    def _fallback_answer(self, query: str, records: list, analysis: dict) -> str:
        """Responde directamente si el LLM falla, para preguntas simples"""
        q = query.lower()
        
        # Contar hombres
        if "cuánt" in q and ("hombre" in q or "masculino" in q):
            hombres = [r for r in records if r.genero and r.genero.lower() in ["masculino", "hombre", "m"]]
            
            # Si hay filtro de edad específico
            if "mayor de" in q or "más de" in q:
                match = re.search(r"(mayor de|más de)\s+(\d+)", q)
                if match:
                    edad_limite = int(match.group(2))
                    hombres_filtrados = [h for h in hombres if h.edad is not None and h.edad > edad_limite]
                    return f"Hay {len(hombres_filtrados)} hombres de más de {edad_limite} años registrados."
            
            if "menor de" in q:
                match = re.search(r"menor de\s+(\d+)", q)
                if match:
                    edad_limite = int(match.group(2))
                    hombres_filtrados = [h for h in hombres if h.edad is not None and h.edad < edad_limite]
                    return f"Hay {len(hombres_filtrados)} hombres menores de {edad_limite} años registrados."
            
            return f"Hay {len(hombres)} hombres registrados."
        
        # Contar mujeres
        if "cuánt" in q and ("mujer" in q or "femenino" in q):
            mujeres = [r for r in records if r.genero and r.genero.lower() in ["femenino", "mujer", "f"]]
            
            # Si hay filtro de edad específico
            if "mayor de" in q or "más de" in q:
                match = re.search(r"(mayor de|más de)\s+(\d+)", q)
                if match:
                    edad_limite = int(match.group(2))
                    mujeres_filtradas = [m for m in mujeres if m.edad is not None and m.edad > edad_limite]
                    return f"Hay {len(mujeres_filtradas)} mujeres de más de {edad_limite} años registradas."
            
            if "menor de" in q:
                match = re.search(r"menor de\s+(\d+)", q)
                if match:
                    edad_limite = int(match.group(2))
                    mujeres_filtradas = [m for m in mujeres if m.edad is not None and m.edad < edad_limite]
                    return f"Hay {len(mujeres_filtradas)} mujeres menores de {edad_limite} años registradas."
                
            return f"Hay {len(mujeres)} mujeres registradas."
        
        # Contar total
        if "cuánt" in q and ("persona" in q or "total" in q):
            return f"Hay {len(records)} personas registradas en total."
        
        # Buscar persona mayor
        if "mayor" in q or "más viejo" in q:
            if records:
                mayor = max(records, key=lambda r: r.edad if r.edad is not None else -1)
                if mayor.edad is not None:
                    return f"La persona mayor registrada es {mayor.nombre_completo} con {mayor.edad} años."
        
        # Buscar persona más joven
        if "más joven" in q or "menor" in q and "edad" in q:
            if records:
                menor = min(records, key=lambda r: r.edad if r.edad is not None else float('inf'))
                if menor.edad is not None:
                    return f"La persona más joven registrada es {menor.nombre_completo} con {menor.edad} años."
        
        return ""

    def _build_academic_prompt(self, user_query: str, filtered_records: list, analysis: dict) -> str:
        """Construye un prompt académico específico para el contexto"""
        
        # Limitar registros para evitar prompts muy largos
        sample_records = filtered_records[:20] if len(filtered_records) > 20 else filtered_records
        
        context_data = []
        for record in sample_records:
            context_data.append({
                "nombre": record.nombre_completo,
                "edad": record.edad,
                "genero": record.genero,
                "documento": record.documento  # ← CORRECCIÓN: era record.numero_documento
            })
        
        prompt = f"""
Eres un asistente de análisis de datos académico. Responde de manera precisa y específica basándote ÚNICAMENTE en los datos proporcionados.

CONSULTA DEL USUARIO: {user_query}

DATOS DISPONIBLES ({len(context_data)} registros):
{context_data}

INSTRUCCIONES:
1. Responde ÚNICAMENTE con información que puedas calcular de los datos proporcionados
2. Si la pregunta es sobre conteos, proporciona el número exacto
3. Si la pregunta es sobre estadísticas, calcula basándote en los datos
4. Si no hay suficientes datos para responder, di "No hay suficientes datos para responder esta consulta"
5. Sé específico y directo en tu respuesta
6. NO inventes información que no esté en los datos

RESPUESTA:"""

        return prompt

    def _update_metrics(self, processing_time: float, success: bool) -> None:
        """Actualiza métricas del sistema"""
        self.metrics.total_queries += 1
        if success:
            self.metrics.successful_queries += 1
        else:
            self.metrics.failed_queries += 1
        
        # Actualizar tiempo promedio
        total_time = self.metrics.avg_response_time * (self.metrics.total_queries - 1)
        self.metrics.avg_response_time = (total_time + processing_time) / self.metrics.total_queries
        self.metrics.last_updated = datetime.now()

    def _create_error_response(self, error_message: str) -> Dict[str, Any]:
        """Crea respuesta de error estándar"""
        return {
            "answer": error_message,
            "metadata": {
                "query_type": "error",
                "query_complexity": "unknown",
                "dataset_size": 0,
                "processing_time_ms": 0,
                "patterns_detected": [],
                "data_enrichment": "error"
            }
        }

# ============================================================================
# INICIALIZACIÓN DEL SISTEMA
# ============================================================================

# Instancias globales del sistema
firebase_manager = FirebaseManager()
groq_client = GroqLLMClient()
data_manager = IntelligentDataManager(firebase_manager)
rag_processor = AcademicRAGProcessor(groq_client, data_manager)

# ============================================================================
# ENDPOINTS DE LA API - CORRECCIÓN PRINCIPAL
# ============================================================================

@app.post("/consulta-natural", response_model=Dict[str, Any])  # ← ENDPOINT CORRECTO
async def process_natural_language_query(request: Dict = Body(...)):
    """
    Endpoint principal para consultas en lenguaje natural desde el frontend
    """
    query_text = request.get("consulta", "").strip()  # ← Campo correcto
    
    if not query_text:
        return JSONResponse(
            status_code=400,
            content={"error": "Consulta vacía o inválida"}
        )
    
    logger.info(f"🎓 Consulta académica recibida: {query_text}")
    
    result = rag_processor.process_academic_query(query_text)
    
    # Log to Firebase if available
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

# Mantener el endpoint original también por compatibilidad
@app.post("/query", response_model=Dict[str, Any])
async def process_query_legacy(query: Dict = Body(...)):
    """Endpoint legacy - redirige al nuevo"""
    query_text = query.get("query", "").strip()
    return await process_natural_language_query({"consulta": query_text})

# ============================================================================
# HEALTH CHECK Y MÉTRICAS DEL SISTEMA
# ============================================================================

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
        "ejemplos_predeterminados": [
            "¿Cuántas personas están registradas en total?",
            "¿Cuál es la distribución por género?",
            "¿Quién es la persona más joven registrada?",
            "¿Quién es la persona mayor registrada?",
            "¿Cuántas personas nacieron en abril?",
            "¿Cuál es el promedio de edad de las personas registradas?",
            "¿Cuántos hombres de más de 25 años hay?",
            "¿Mujeres menores de 30 años nacidas en abril?",
            "¿Quién fue la última persona en registrarse?",
            "¿Qué porcentaje de cada género está registrado?"
        ],
        "info": {
            "predeterminadas": "Estas consultas tienen respuestas precomputadas y son muy rápidas",
            "personalizadas": "Cualquier otra consulta usará inteligencia artificial para generar respuestas"
        }
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