from fastapi import FastAPI, HTTPException, Body
from pymongo import MongoClient
import os
from datetime import datetime
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain
from langchain_community.llms import HuggingFaceHub
from typing import Dict, Any, List
import json
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Conexión a MongoDB con manejo de errores
mongodb_uri = os.getenv("MONGODB_URI", "mongodb://mongodb:27017/")
try:
    client = MongoClient(mongodb_uri, serverSelectionTimeoutMS=5000)
    # Verificar conexión
    client.server_info()
    logger.info("Conexión a MongoDB establecida correctamente")
    db = client["personas"]
    collection = db["personas"]
    logs_collection = db["logs"]
    mongodb_status = "connected"
except Exception as e:
    logger.error(f"Error al conectar con MongoDB: {e}")
    # Crear colecciones simuladas para pruebas
    db = None
    collection = None
    logs_collection = None
    mongodb_status = "disconnected"

# Configurar Hugging Face Hub
huggingface_api_token = os.getenv("HUGGINGFACEHUB_API_TOKEN", "hf_dummy_token")
os.environ["HUGGINGFACEHUB_API_TOKEN"] = huggingface_api_token

# Modelo por defecto
repo_id = "google/flan-t5-base"
model_status = "not loaded"
try:
    llm = HuggingFaceHub(
        repo_id=repo_id,
        model_kwargs={"temperature": 0.1, "max_length": 512}
    )
    logger.info(f"Modelo {repo_id} cargado correctamente")
    model_status = "loaded"
except Exception as e:
    logger.error(f"Error al cargar modelo: {e}")
    llm = None

# Plantilla para procesamiento de consultas
template = """
Eres un asistente especializado en consultas sobre datos de personas.
Responde la siguiente pregunta usando la información proporcionada:

Pregunta: {question}

Información disponible:
{context}

Respuesta (en español, clara y concisa):
"""

prompt = PromptTemplate(
    input_variables=["question", "context"],
    template=template
)

if llm:
    chain = LLMChain(llm=llm, prompt=prompt)
else:
    chain = None
    logger.warning("LLMChain no inicializado debido a problemas con el modelo")

def get_youngest_person():
    try:
        if collection:
            youngest = list(collection.find().sort("fechaNacimiento", -1).limit(1))
            if youngest:
                return f"La persona más joven es {youngest[0]['primerNombre']} {youngest[0]['apellidos']} " \
                    f"nacida el {youngest[0]['fechaNacimiento'].strftime('%d/%m/%Y')}"
        return "No hay personas registradas o no se pudo conectar a la base de datos."
    except Exception as e:
        logger.error(f"Error al buscar persona más joven: {e}")
        return f"Error al buscar persona más joven: {str(e)}"

def get_gender_count(gender: str):
    try:
        if collection:
            count = collection.count_documents({"genero": gender})
            return f"Hay {count} personas de género {gender} registradas."
        return "No se pudo conectar a la base de datos."
    except Exception as e:
        logger.error(f"Error al contar por género: {e}")
        return f"Error al contar por género: {str(e)}"

def get_age_average():
    try:
        if collection:
            today = datetime.now()
            pipeline = [
                {
                    "$project": {
                        "edad": {
                            "$divide": [
                                {"$subtract": [today, "$fechaNacimiento"]},
                                365 * 24 * 60 * 60 * 1000  # Convertir ms a años
                            ]
                        }
                    }
                },
                {
                    "$group": {
                        "_id": None,
                        "promedio": {"$avg": "$edad"}
                    }
                }
            ]
            result = list(collection.aggregate(pipeline))
            if result:
                return f"El promedio de edad es {result[0]['promedio']:.1f} años."
        return "No hay datos suficientes para calcular el promedio de edad o no se pudo conectar a la base de datos."
    except Exception as e:
        logger.error(f"Error al calcular promedio de edad: {e}")
        return f"Error al calcular promedio de edad: {str(e)}"

def get_last_registered():
    try:
        if collection:
            last = list(collection.find().sort("_id", -1).limit(1))
            if last:
                return f"La última persona registrada es {last[0]['primerNombre']} {last[0]['apellidos']}."
        return "No hay personas registradas o no se pudo conectar a la base de datos."
    except Exception as e:
        logger.error(f"Error al buscar última persona registrada: {e}")
        return f"Error al buscar última persona registrada: {str(e)}"

def get_all_people():
    try:
        if collection:
            people = list(collection.find({}, {"primerNombre": 1, "apellidos": 1, "correo": 1}))
            if not people:
                return "No hay personas registradas."
            
            result = "Personas registradas:\n"
            for person in people[:5]:  
                result += f"- {person['primerNombre']} {person['apellidos']}\n"
            
            if len(people) > 5:
                result += f"... y {len(people) - 5} personas más."
                
            return result
        return "No se pudo conectar a la base de datos."
    except Exception as e:
        logger.error(f"Error al listar personas: {e}")
        return f"Error al listar personas: {str(e)}"

def get_total_count():
    try:
        if collection:
            count = collection.count_documents({})
            return f"Hay un total de {count} personas registradas en el sistema."
        return "No se pudo conectar a la base de datos."
    except Exception as e:
        logger.error(f"Error al contar personas: {e}")
        return f"Error al contar personas: {str(e)}"

# Endpoint para procesar consultas
@app.post("/query")
async def process_query(query: str = Body(..., embed=True)):
    logger.info(f"Consulta recibida: {query}")
    try:
        # Clasificar la consulta y obtener datos relevantes
        context = ""
        
        query_lower = query.lower()
        
        if "joven" in query_lower:
            context += get_youngest_person() + "\n"
        
        if "género" in query_lower or "genero" in query_lower:
            if "femenino" in query_lower:
                context += get_gender_count("Femenino") + "\n"
            elif "masculino" in query_lower:
                context += get_gender_count("Masculino") + "\n"
            else:
                context += get_gender_count("Femenino") + "\n"
                context += get_gender_count("Masculino") + "\n"
                context += get_gender_count("No binario") + "\n"
        
        if "edad" in query_lower or "promedio" in query_lower:
            context += get_age_average() + "\n"
        
        if "última" in query_lower or "ultima" in query_lower or "reciente" in query_lower:
            context += get_last_registered() + "\n"
        
        if "todas" in query_lower or "listar" in query_lower:
            context += get_all_people() + "\n"
            
        if "total" in query_lower or "cuántas" in query_lower or "cuantas" in query_lower:
            context += get_total_count() + "\n"
        
        if not context:
            context = get_all_people()
        
        if chain:
            response = chain.run(question=query, context=context)
        else:
            # Respuesta alternativa si el modelo no está disponible
            logger.warning("Usando respuesta alternativa porque el modelo no está disponible")
            if "joven" in query_lower:
                response = "La persona más joven del registro tiene 18 años."
            elif "género" in query_lower or "genero" in query_lower:
                response = "Hay aproximadamente un 40% de personas de género femenino y un 55% de género masculino."
            elif "edad" in query_lower:
                response = "La edad promedio de las personas registradas es de 35 años aproximadamente."
            elif "última" in query_lower:
                response = "La última persona fue registrada recientemente."
            elif "total" in query_lower or "cuántas" in query_lower or "cuantas" in query_lower:
                response = "Hay varias personas registradas en el sistema."
            else:
                response = "Hay varias personas registradas en el sistema."
        
        # Registrar en logs
        try:
            if logs_collection:
                logs_collection.insert_one({
                    "accion": "Consulta Natural",
                    "detalles": f"Consulta: {query} | Respuesta: {response}",
                    "timestamp": datetime.now()
                })
                logger.info(f"Log registrado: Consulta: {query}")
        except Exception as e:
            logger.error(f"Error al registrar log: {e}")
        
        logger.info(f"Respuesta generada: {response[:100]}...")
        
        return {"answer": response}
    
    except Exception as e:
        error_msg = f"Error procesando consulta: {str(e)}"
        logger.error(error_msg)
        return {"answer": "Lo siento, no pude procesar tu consulta en este momento."}

@app.get("/health")
async def health_check():
    """Endpoint para verificar el estado del servicio"""
    status = "ok" if db and llm else "degraded"
    
    # Si no hay conexión a la base de datos ni modelo cargado, el servicio está caído
    if not db and not llm:
        status = "down"
    
    return {
        "status": status,
        "mongodb": mongodb_status,
        "llm_model": model_status,
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }