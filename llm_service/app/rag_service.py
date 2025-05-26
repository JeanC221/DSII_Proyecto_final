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
    
    # CORRECCIÓN: Inicializar todos los campos opcionales
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
        """CORRECCIÓN: Asegurar que se asignen todos los campos temporales"""
        birth_date = raw_data.get('fechaNacimiento')
        
        # CORRECCIÓN: Verificar múltiples formatos de fecha
        if birth_date:
            try:
                # Si es un timestamp de Firebase
                if hasattr(birth_date, 'todate'):
                    birth_date = birth_date.todate()
                # Si es una cadena, intentar parsearlo
                elif isinstance(birth_date, str):
                    # Intentar varios formatos
                    for date_format in ['%Y-%m-%d', '%d/%m/%Y', '%Y-%m-%dT%H:%M:%S']:
                        try:
                            birth_date = datetime.strptime(birth_date, date_format)
                            break
                        except ValueError:
                            continue
                else:
                    logger.warning(f"⚠️ No se pudo parsear fecha de nacimiento: {birth_date}")
                    birth_date = None
            
                if birth_date and isinstance(birth_date, datetime):
                    record.edad = self._calculate_exact_age(birth_date, current_date)
                    record.mes_nacimiento = birth_date.month
                    record.mes_nacimiento_nombre = self.month_names.get(birth_date.month, f"mes_{birth_date.month}")
                    record.año_nacimiento = birth_date.year
                    
                    logger.info(f"🔍 DEBUG - Persona: {record.nombre_completo}, Edad: {record.edad}, Mes: {record.mes_nacimiento}")
                else:
                    logger.warning(f"⚠️ Fecha de nacimiento inválida para {record.nombre_completo}: {raw_data.get('fechaNacimiento')}")
                    
            except Exception as e:
                logger.warning(f"⚠️ Error procesando fecha de nacimiento para {record.nombre_completo}: {e}")
        
        # Fecha de registro
        created_at = raw_data.get('createdAt')
        if created_at:
            try:
                if hasattr(created_at, 'todate'):
                    record.fecha_registro = created_at.todate()
                elif isinstance(created_at, str):
                    record.fecha_registro = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            except Exception as e:
                logger.warning(f"⚠️ Error procesando fecha de registro para {record.nombre_completo}: {e}")

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

    def _build_statistics_for_llm(self, records: list, total_records: int) -> dict:
        """Pre-calcula estadísticas para que el LLM las use directamente"""
        
        total_personas = len(records)
        personas_con_edad = [r for r in records if r.edad is not None and r.edad >= 0]
        
        # Distribución por género
        hombres = [r for r in records if r.genero and r.genero.lower() in ["masculino", "hombre", "m"]]
        mujeres = [r for r in records if r.genero and r.genero.lower() in ["femenino", "mujer", "f"]]
        
        # Estadísticas de edad
        stats_edad = {}
        if personas_con_edad:
            edades = [r.edad for r in personas_con_edad]
            stats_edad = {
                "edad_minima": min(edades),
                "edad_maxima": max(edades),
                "promedio_edad": round(sum(edades) / len(edades), 1),
                "personas_mayor_edad": len([e for e in edades if e >= 18]),
                "personas_menor_edad": len([e for e in edades if e < 18])
            }
        
        # Distribución por meses
        distribucion_meses = {}
        personas_con_mes = [r for r in records if hasattr(r, 'mes_nacimiento') and r.mes_nacimiento]
        if personas_con_mes:
            meses_nombres = {1: 'enero', 2: 'febrero', 3: 'marzo', 4: 'abril', 5: 'mayo', 6: 'junio',
                            7: 'julio', 8: 'agosto', 9: 'septiembre', 10: 'octubre', 11: 'noviembre', 12: 'diciembre'}
            
            conteo_meses = {}
            for persona in personas_con_mes:
                mes = persona.mes_nacimiento
                conteo_meses[mes] = conteo_meses.get(mes, 0) + 1
            
            for mes_num, cantidad in conteo_meses.items():
                mes_nombre = meses_nombres.get(mes_num, f"mes_{mes_num}")
                distribucion_meses[mes_nombre] = cantidad
        
        # Información de contacto
        personas_con_correo = [r for r in records if r.correo and r.correo.strip() and "@" in r.correo]
        personas_con_telefono = [r for r in records if r.celular and r.celular.strip()]
        
        # Fechas de registro
        fecha_registro_info = {}
        personas_con_fecha_registro = [r for r in records if hasattr(r, 'fecha_registro') and r.fecha_registro]
        if personas_con_fecha_registro:
            fechas_ordenadas = sorted(personas_con_fecha_registro, key=lambda r: r.fecha_registro)
            fecha_registro_info = {
                "primera_persona_registrada": {
                    "nombre": fechas_ordenadas[0].nombre_completo,
                    "fecha": fechas_ordenadas[0].fecha_registro.strftime("%Y-%m-%d")
                },
                "ultima_persona_registrada": {
                    "nombre": fechas_ordenadas[-1].nombre_completo,
                    "fecha": fechas_ordenadas[-1].fecha_registro.strftime("%Y-%m-%d")
                }
            }
        
        return {
            "conteos_generales": {
                "total_personas": total_personas,
                "total_hombres": len(hombres),
                "total_mujeres": len(mujeres),
                "personas_con_edad_valida": len(personas_con_edad),
                "personas_con_correo": len(personas_con_correo),
                "personas_con_telefono": len(personas_con_telefono)
            },
            "estadisticas_edad": stats_edad,
            "distribucion_meses_nacimiento": distribucion_meses,
            "informacion_registro": fecha_registro_info,
            "porcentajes_genero": {
                "porcentaje_hombres": round((len(hombres) / total_personas) * 100, 1) if total_personas > 0 else 0,
                "porcentaje_mujeres": round((len(mujeres) / total_personas) * 100, 1) if total_personas > 0 else 0
            }
        }

    def _build_academic_prompt(self, user_query: str, filtered_records: list, analysis: dict) -> str:
        """Construye prompt completo para RAG con datos + estadísticas"""
        
        # Limitar registros para no sobrecargar el prompt
        sample_records = filtered_records[:15] if len(filtered_records) > 15 else filtered_records
        
        # Pre-calcular estadísticas
        statistics = self._build_statistics_for_llm(sample_records, len(filtered_records))
        
        # Construir datos detallados
        context_data = []
        for record in sample_records:
            record_data = {
                "nombre_completo": record.nombre_completo,
                "edad_anos": record.edad if record.edad is not None else None,
                "tiene_edad_valida": record.edad is not None and record.edad >= 0,
                "genero": record.genero if record.genero else None,
                "documento": record.documento,
                "correo": record.correo if record.correo and "@" in record.correo else None,
                "celular": record.celular if record.celular and record.celular.strip() else None,
                "mes_nacimiento_numero": record.mes_nacimiento if record.mes_nacimiento else None,
                "mes_nacimiento_nombre": record.mes_nacimiento_nombre if record.mes_nacimiento_nombre else None,
                "año_nacimiento": record.año_nacimiento if record.año_nacimiento else None,
                "fecha_registro": record.fecha_registro.strftime("%Y-%m-%d") if record.fecha_registro else None,
                "es_mayor_edad": record.edad >= 18 if record.edad is not None else None
            }
            context_data.append(record_data)
        
        # Debug logging
        logger.info(f"🔍 RAG PROMPT - Consulta: '{user_query}'")
        logger.info(f"🔍 RAG PROMPT - Registros: {len(context_data)}")
        logger.info(f"🔍 RAG PROMPT - Con edad válida: {statistics['conteos_generales']['personas_con_edad_valida']}")
        
        # PROMPT COMPLETO PARA RAG
        prompt = f"""
Eres un experto en análisis de datos demográficos. Analiza los datos proporcionados y responde la pregunta del usuario de manera precisa y directa.

PREGUNTA: {user_query}

ESTADÍSTICAS PRE-CALCULADAS:
{json.dumps(statistics, indent=2, ensure_ascii=False)}

DATOS DETALLADOS ({len(context_data)} personas):
{json.dumps(context_data, indent=2, ensure_ascii=False)}

INSTRUCCIONES PARA RESPONDER:

1. PERSONA MÁS JOVEN/MAYOR:
   - Busca el valor de "edad_anos" MÁS BAJO (joven) o MÁS ALTO (mayor)
   - Solo considera registros donde "tiene_edad_valida" sea true
   - Formato: "La persona más joven es [nombre_completo] con [edad_anos] años"

2. CONTEOS SIMPLES:
   - Usa las estadísticas pre-calculadas en "conteos_generales"
   - Formato: "Hay X personas/hombres/mujeres registradas"

3. FILTROS POR EDAD:
   - Examina TODOS los registros detallados
   - Aplica la condición específica (mayor de X, menor de X, entre X y Y)
   - Cuenta solo registros que cumplan la condición exacta

4. CONSULTAS POR MES:
   - Usa "distribucion_meses_nacimiento" para conteos rápidos
   - Para nombres específicos, busca en los datos detallados por "mes_nacimiento_nombre"

5. PROMEDIOS:
   - Usa "promedio_edad" de las estadísticas pre-calculadas
   - Para promedios por género, calcula desde los datos detallados

6. BÚSQUEDAS ESPECÍFICAS:
   - Para documentos/correos/teléfonos: busca en los campos respectivos
   - Para nombres: busca en "nombre_completo"

7. CONSULTAS TEMPORALES:
   - Usa "informacion_registro" para primera/última persona registrada

REGLAS CRÍTICAS:
- Responde SOLO con información de los datos proporcionados
- Si no hay datos suficientes: "No hay información suficiente para responder esta pregunta"
- Usa "nombre_completo" exacto de los registros
- Máximo 2 oraciones de respuesta
- Sin explicaciones metodológicas

FORMATO DE RESPUESTA:
- Directo y específico
- Números exactos de los datos
- Nombres completos reales
- Sin palabras como "análisis" o "metodología"

RESPUESTA:"""

        return prompt

    def process_academic_query(self, user_query: str) -> Dict[str, Any]:
        """Procesamiento RAG PURO - Solo LLM + datos reales"""
        start_time = time.time()
        
        try:
            logger.info(f"🔍 INICIANDO RAG PURO: '{user_query}'")
            
            # 1. Obtener datos reales desde Firebase
            dataset = self.data_manager.get_enriched_dataset()
            logger.info(f"🔍 Dataset: {len(dataset)} registros")

            if not dataset:
                return self._create_error_response("No hay datos disponibles en la base de datos")

            valid_records = [r for r in dataset if r.nombre_completo and r.nombre_completo.strip()]
            if not valid_records:
                return self._create_error_response("No hay registros válidos en la base de datos")

            # 2. Analizar consulta
            query_analysis = self.query_analyzer.analyze_complexity(user_query)
            logger.info(f"🔍 Análisis: {query_analysis}")

            # 3. Filtrar registros (opcional para optimización)
            filtered_records = self._filter_records_by_query(user_query, valid_records, query_analysis)
            if not filtered_records:
                filtered_records = valid_records

            logger.info(f"🔍 Registros filtrados: {len(filtered_records)}")

            # 4. Construir prompt RAG completo
            academic_prompt = self._build_academic_prompt(user_query, filtered_records, query_analysis)

            # 5. Configurar tokens
            max_tokens = 100 if query_analysis['complexity_level'] == 'simple' else 200

            # 6. PROCESAR SOLO CON LLM - NO HAY FALLBACK
            logger.info("🤖 Enviando a Groq LLM (RAG puro)...")
            llm_response = self.llm._make_request_with_retry(academic_prompt, max_tokens=max_tokens)

            # 7. Verificar respuesta
            if not llm_response or not llm_response.strip():
                logger.error("❌ LLM no respondió")
                return self._create_error_response("El sistema de IA no pudo procesar la consulta")

            logger.info(f"✅ RAG completado: '{llm_response[:100]}...'")

            # 8. Respuesta final
            processing_time = time.time() - start_time
            self._update_metrics(processing_time, success=True)

            return {
                "answer": llm_response.strip(),
                "metadata": {
                    "query_type": "rag_pure",
                    "query_complexity": query_analysis['complexity_level'],
                    "dataset_size": len(filtered_records),
                    "processing_time_ms": round(processing_time * 1000, 2),
                    "patterns_detected": query_analysis['detected_patterns'],
                    "data_enrichment": "full_rag_with_statistics",
                    "llm_provider": "groq",
                    "model_used": self.llm.model,
                    "rag_mode": "pure_no_fallback"
                }
            }

        except Exception as e:
            processing_time = time.time() - start_time
            self._update_metrics(processing_time, success=False)
            logger.error(f"❌ Error RAG: {e}")
            return self._create_error_response(f"Error en el sistema RAG: {str(e)}")

    # ELIMINAR COMPLETAMENTE _fallback_answer()
    # def _fallback_answer(self, query: str, records: list, analysis: dict) -> str:
    #     """ELIMINADO - Solo RAG puro"""
    #     pass

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
        "service": "rag",
        "firebase": "connected" if firebase_healthy else "disconnected",
        "data_retriever": "available" if firebase_healthy else "unavailable",
        "llm_model": "loaded" if groq_healthy else "not loaded",
        "rag_service_url": "http://rag_service:8000",
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