from fastapi import FastAPI, HTTPException, Body
import os
from datetime import datetime
import logging
from typing import Dict, Any, List
import json

import firebase_admin
from firebase_admin import credentials, firestore, initialize_app

from langchain_core.prompts import PromptTemplate
from langchain.chains.llm import LLMChain
from langchain_community.llms import HuggingFaceHub

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

firebase_status = "disconnected"
db = None
collection = None
logs_collection = None

try:
    cred_path = os.environ.get('FIREBASE_CREDENTIALS_PATH', '/app/firebase-credentials.json')
    project_id = os.environ.get('FIREBASE_PROJECT_ID', 'proyecto-final-gestordatos')
    
    cred = credentials.Certificate(cred_path)
    firebase_app = initialize_app(cred, {
        'projectId': project_id,
    })
    
    db = firestore.client()
    collection = db.collection('personas')
    logs_collection = db.collection('logs')
    
    firebase_status = "connected"
    logger.info("Conexión a Firebase establecida correctamente")
except Exception as e:
    logger.error(f"Error al conectar con Firebase: {e}")

huggingface_api_token = os.getenv("HUGGINGFACEHUB_API_TOKEN", "hf_dummy_token")
os.environ["HUGGINGFACEHUB_API_TOKEN"] = huggingface_api_token

repo_id = "google/flan-t5-base"
model_status = "not loaded"
llm = None

try:
    llm = HuggingFaceHub(
        repo_id=repo_id,
        model_kwargs={"temperature": 0.1, "max_length": 512}
    )
    logger.info(f"Modelo {repo_id} cargado correctamente")
    model_status = "loaded"
except Exception as e:
    logger.error(f"Error al cargar modelo: {e}")

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

chain = LLMChain(llm=llm, prompt=prompt) if llm else None

def format_date(timestamp):
    if hasattr(timestamp, 'todate'):
        return timestamp.todate().strftime('%d/%m/%Y')
    elif isinstance(timestamp, datetime):
        return timestamp.strftime('%d/%m/%Y')
    elif isinstance(timestamp, str):
        try:
            return datetime.fromisoformat(timestamp.replace('Z', '+00:00')).strftime('%d/%m/%Y')
        except:
            return timestamp
    return str(timestamp)

def get_youngest_person():
    try:
        if not collection:
            return "No se pudo conectar a la base de datos."
            
        youngest_query = collection.order_by('fechaNacimiento', direction=firestore.Query.DESCENDING).limit(1)
        youngest_docs = list(youngest_query.stream())
        
        if not youngest_docs:
            return "No hay personas registradas en el sistema."
            
        youngest = youngest_docs[0].to_dict()
        fecha = format_date(youngest.get('fechaNacimiento'))
        
        return f"La persona más joven es {youngest['primerNombre']} {youngest['apellidos']} nacida el {fecha}"
    except Exception as e:
        logger.error(f"Error al buscar persona más joven: {e}")
        return f"Error al buscar persona más joven: {str(e)}"

def get_gender_count(gender: str):
    try:
        if not collection:
            return "No se pudo conectar a la base de datos."
            
        count_query = collection.where('genero', '==', gender)
        count_docs = list(count_query.stream())
        count = len(count_docs)
        
        return f"Hay {count} personas de género {gender} registradas."
    except Exception as e:
        logger.error(f"Error al contar personas por género: {e}")
        return f"Error al contar por género: {str(e)}"

def get_age_average():
    try:
        if not collection:
            return "No se pudo conectar a la base de datos."
            
        all_persons = list(collection.stream())
        
        if not all_persons:
            return "No hay personas registradas en el sistema."
            
        today = datetime.now()
        total_age = 0
        valid_persons = 0
        
        for doc in all_persons:
            person = doc.to_dict()
            birth_date = person.get('fechaNacimiento')
            
            if not birth_date:
                continue
                
            if hasattr(birth_date, 'todate'):
                birth_date = birth_date.todate()
            elif isinstance(birth_date, str):
                try:
                    birth_date = datetime.fromisoformat(birth_date.replace('Z', '+00:00'))
                except:
                    continue
                    
            age_days = (today - birth_date).days
            age_years = age_days / 365.25
            
            total_age += age_years
            valid_persons += 1
            
        if valid_persons == 0:
            return "No hay fechas de nacimiento válidas para calcular la edad promedio."
            
        avg_age = total_age / valid_persons
        return f"El promedio de edad es {avg_age:.1f} años."
    except Exception as e:
        logger.error(f"Error al calcular promedio de edad: {e}")
        return f"Error al calcular promedio de edad: {str(e)}"

def get_last_registered():
    try:
        if not collection:
            return "No se pudo conectar a la base de datos."
            
        last_query = collection.order_by('createdAt', direction=firestore.Query.DESCENDING).limit(1)
        last_docs = list(last_query.stream())
        
        if not last_docs:
            return "No hay personas registradas en el sistema."
            
        last = last_docs[0].to_dict()
        return f"La última persona registrada es {last['primerNombre']} {last['apellidos']}."
    except Exception as e:
        logger.error(f"Error al buscar última persona registrada: {e}")
        return f"Error al buscar última persona registrada: {str(e)}"

def get_all_people():
    try:
        if not collection:
            return "No se pudo conectar a la base de datos."
            
        people_docs = list(collection.stream())
        
        if not people_docs:
            return "No hay personas registradas en el sistema."
            
        result = "Personas registradas:\n"
        
        for i, doc in enumerate(people_docs[:5]):
            person = doc.to_dict()
            result += f"- {person['primerNombre']} {person.get('segundoNombre', '')} {person['apellidos']}\n"
            
        if len(people_docs) > 5:
            result += f"... y {len(people_docs) - 5} personas más."
            
        return result
    except Exception as e:
        logger.error(f"Error al listar personas: {e}")
        return f"Error al listar personas: {str(e)}"

def get_total_count():
    try:
        if not collection:
            return "No se pudo conectar a la base de datos."
            
        all_docs = list(collection.stream())
        count = len(all_docs)
        
        return f"Hay un total de {count} personas registradas en el sistema."
    except Exception as e:
        logger.error(f"Error al contar personas: {e}")
        return f"Error al contar personas: {str(e)}"

def get_document_info(document_number: str):
    try:
        if not collection:
            return "No se pudo conectar a la base de datos."
            
        person_query = collection.where('nroDocumento', '==', document_number)
        person_docs = list(person_query.stream())
        
        if not person_docs:
            return f"No se encontró ninguna persona con número de documento {document_number}."
            
        person = person_docs[0].to_dict()
        return f"Se encontró a {person['primerNombre']} {person['apellidos']} con número de documento {document_number}."
    except Exception as e:
        logger.error(f"Error al buscar por documento: {e}")
        return f"Error al buscar por documento: {str(e)}"

def get_gender_distribution():
    try:
        if not collection:
            return "No se pudo conectar a la base de datos."
            
        all_docs = list(collection.stream())
        
        if not all_docs:
            return "No hay personas registradas en el sistema."
            
        total = len(all_docs)
        genders = {"Masculino": 0, "Femenino": 0, "No binario": 0, "Prefiero no reportar": 0}
        
        for doc in all_docs:
            person = doc.to_dict()
            gender = person.get('genero')
            if gender in genders:
                genders[gender] += 1
                
        result = "Distribución por género:\n"
        for gender, count in genders.items():
            percentage = (count / total * 100) if total > 0 else 0
            result += f"- {gender}: {count} personas ({percentage:.1f}%)\n"
            
        return result
    except Exception as e:
        logger.error(f"Error al obtener distribución por género: {e}")
        return f"Error al obtener distribución por género: {str(e)}"

@app.post("/query")
async def process_query(query: Dict = Body(...)):
    query_text = query.get("query", "")
    logger.info(f"Consulta recibida: {query_text}")
    
    try:
        context = ""
        query_lower = query_text.lower()
        
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
            response = chain.run(question=query_text, context=context)
        else:
            logger.warning("Usando respuesta alternativa porque el modelo no está disponible")
            response = generate_fallback_response(query_lower, context)
        
        try:
            if logs_collection:
                logs_collection.add({
                    "accion": "Consulta Natural",
                    "detalles": f"Consulta: {query_text} | Respuesta: {response[:150]}{'...' if len(response) > 150 else ''}",
                    "timestamp": firestore.SERVER_TIMESTAMP
                })
                logger.info(f"Log registrado en Firebase: Consulta: {query_text}")
        except Exception as e:
            logger.error(f"Error al registrar log en Firebase: {e}")
        
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
    status = "ok" if db and llm else "degraded"
    
    if not db and not llm:
        status = "down"
    
    return {
        "status": status,
        "firebase": firebase_status,
        "llm_model": model_status,
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }