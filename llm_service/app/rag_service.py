from fastapi import FastAPI, HTTPException, Body
from pymongo import MongoClient
import os
from datetime import datetime
from langchain_core.prompts import PromptTemplate  
from langchain.chains.llm import LLMChain  
from langchain_community.llms import HuggingFaceHub
from typing import Dict, Any, List
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

mongodb_uri = os.getenv("MONGODB_URI", "mongodb://mongodb:27017/")
try:
    client = MongoClient(mongodb_uri, serverSelectionTimeoutMS=5000)
    client.server_info()
    logger.info("Conexión a MongoDB establecida correctamente")
    db = client["personas"]
    collection = db["personas"]
    logs_collection = db["logs"]
    mongodb_status = "connected"
except Exception as e:
    logger.error(f"Error al conectar con MongoDB: {e}")
    db = None
    collection = None
    logs_collection = None
    mongodb_status = "disconnected"

huggingface_api_token = os.getenv("HUGGINGFACEHUB_API_TOKEN", "hf_dummy_token")
os.environ["HUGGINGFACEHUB_API_TOKEN"] = huggingface_api_token

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

template = """
Eres un asistente especializado en consultas sobre datos de personas.
Responde la siguiente pregunta usando solo la información proporcionada, de forma clara y concisa.
Tus respuestas deben ser completas pero directas al punto.

Pregunta: {question}

Información disponible:
{context}

Respuesta (en español, clara y precisa, usando solo la información disponible):
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
                                365 * 24 * 60 * 60 * 1000  
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

def get_document_info(document_number: str):
    try:
        if collection:
            person = collection.find_one({"nroDocumento": document_number})
            if person:
                return f"Se encontró a {person['primerNombre']} {person['apellidos']} " \
                    f"con número de documento {document_number}."
            else:
                return f"No se encontró ninguna persona con número de documento {document_number}."
        return "No se pudo conectar a la base de datos."
    except Exception as e:
        logger.error(f"Error al buscar por documento: {e}")
        return f"Error al buscar por documento: {str(e)}"

def get_gender_distribution():
    try:
        if collection:
            total = collection.count_documents({})
            if total == 0:
                return "No hay personas registradas en el sistema."
                
            genders = ["Masculino", "Femenino", "No binario", "Prefiero no reportar"]
            result = "Distribución por género:\n"
            
            for gender in genders:
                count = collection.count_documents({"genero": gender})
                percentage = (count / total * 100) if total > 0 else 0
                result += f"- {gender}: {count} personas ({percentage:.1f}%)\n"
                
            return result
        return "No se pudo conectar a la base de datos."
    except Exception as e:
        logger.error(f"Error al obtener distribución por género: {e}")
        return f"Error al obtener distribución por género: {str(e)}"

@app.post("/query")
async def process_query(query: str = Body(..., embed=True)):

    logger.info(f"Consulta recibida: {query}")
    try:
        context = ""
        
        query_lower = query.lower()
        
        keywords = {
            "joven": ["joven", "menor", "más joven", "edad mínima", "menor edad"],
            "genero": ["género", "genero", "hombres", "mujeres", "masculino", "femenino", "no binario"],
            "edad": ["edad", "promedio", "media", "años", "mayores", "cuantos años"],
            "ultima": ["última", "ultima", "reciente", "nuevo", "nueva", "último registro"],
            "listar": ["todas", "todos", "listar", "lista", "mostrar", "personas", "registros", "personas registradas"],
            "total": ["total", "cuántas", "cuantas", "cantidad", "número", "numero"],
            "documento": ["documento", "identificación", "cedula", "cédula", "tarjeta de identidad", "id"]
        }
        
        if any(kw in query_lower for kw in keywords["joven"]):
            context += get_youngest_person() + "\n"
        
        if any(kw in query_lower for kw in keywords["genero"]):
            if "femenino" in query_lower or "mujer" in query_lower or "mujeres" in query_lower:
                context += get_gender_count("Femenino") + "\n"
            elif "masculino" in query_lower or "hombre" in query_lower or "hombres" in query_lower:
                context += get_gender_count("Masculino") + "\n"
            elif "no binario" in query_lower:
                context += get_gender_count("No binario") + "\n"
            elif "prefiero no reportar" in query_lower:
                context += get_gender_count("Prefiero no reportar") + "\n"
            else:
                context += get_gender_distribution() + "\n"
        
        if any(kw in query_lower for kw in keywords["edad"]):
            context += get_age_average() + "\n"
        
        if any(kw in query_lower for kw in keywords["ultima"]):
            context += get_last_registered() + "\n"
        
        if any(kw in query_lower for kw in keywords["listar"]):
            context += get_all_people() + "\n"
            
        if any(kw in query_lower for kw in keywords["total"]):
            context += get_total_count() + "\n"
            
        import re
        doc_numbers = re.findall(r'\b\d{5,10}\b', query_lower)
        if doc_numbers and any(kw in query_lower for kw in keywords["documento"]):
            for doc in doc_numbers[:1]:  
                context += get_document_info(doc) + "\n"
        
        if not context:
            context = get_total_count() + "\n"
            context += "Puedo darte información sobre cantidad de personas, distribución por género, edades, etc.\n"
            context += "Intenta preguntar por ejemplo: '¿Cuántas personas hay registradas?', '¿Cuál es el promedio de edad?'\n"
        
        if chain:
            response = chain.run(question=query, context=context)
        else:
            logger.warning("Usando respuesta alternativa porque el modelo no está disponible")
            response = generate_fallback_response(query_lower, context)
        
        try:
            if logs_collection:
                logs_collection.insert_one({
                    "accion": "Consulta Natural",
                    "detalles": f"Consulta: {query} | Respuesta: {response[:150]}{'...' if len(response) > 150 else ''}",
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

def generate_fallback_response(query_lower, context):

    lines = [line for line in context.split('\n') if line.strip()]
    
    if lines:
        response = "Según la información disponible: " + " ".join(lines[:2])
        return response
    else:
        return "No se encontró información relevante para tu consulta. Por favor, intenta reformular tu pregunta."

@app.get("/health")
async def health_check():
    """Endpoint para verificar el estado del servicio"""
    status = "ok" if db and llm else "degraded"
    
    if not db and not llm:
        status = "down"
    
    return {
        "status": status,
        "mongodb": mongodb_status,
        "llm_model": model_status,
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }