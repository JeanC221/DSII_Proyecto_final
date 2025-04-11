from fastapi import FastAPI, HTTPException, Body
from pymongo import MongoClient
import os
from datetime import datetime
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain
from langchain_community.llms import HuggingFaceHub
from typing import Dict, Any, List
import json

app = FastAPI()

# Conexión a MongoDB
client = MongoClient("mongodb://mongodb:27017/")
db = client["personas"]
collection = db["personas"]
logs_collection = db["logs"]

# Registrar consulta en los logs
def registrar_consulta(query: str, respuesta: str):
    try:
        logs_collection.insert_one({
            "accion": "Consulta Natural",
            "detalles": f"Consulta: {query} | Respuesta: {respuesta}",
            "timestamp": datetime.now()
        })
    except Exception as e:
        print(f"Error al registrar log: {e}")


os.environ["HUGGINGFACEHUB_API_TOKEN"] = "hf_dummy_token"  

repo_id = "google/flan-t5-base"  
llm = HuggingFaceHub(
    repo_id=repo_id,
    model_kwargs={"temperature": 0.1, "max_length": 512}
)

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

chain = LLMChain(llm=llm, prompt=prompt)

def get_youngest_person():
    try:
        youngest = list(collection.find().sort("fechaNacimiento", -1).limit(1))
        if youngest:
            return f"La persona más joven es {youngest[0]['primerNombre']} {youngest[0]['apellidos']} " \
                   f"nacida el {youngest[0]['fechaNacimiento'].strftime('%d/%m/%Y')}"
        return "No hay personas registradas."
    except Exception as e:
        return f"Error al buscar persona más joven: {str(e)}"

def get_gender_count(gender: str):
    try:
        count = collection.count_documents({"genero": gender})
        return f"Hay {count} personas de género {gender} registradas."
    except Exception as e:
        return f"Error al contar por género: {str(e)}"

def get_age_average():
    try:
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
        return "No hay datos suficientes para calcular el promedio de edad."
    except Exception as e:
        return f"Error al calcular promedio de edad: {str(e)}"

def get_last_registered():
    try:
        last = list(collection.find().sort("_id", -1).limit(1))
        if last:
            return f"La última persona registrada es {last[0]['primerNombre']} {last[0]['apellidos']}."
        return "No hay personas registradas."
    except Exception as e:
        return f"Error al buscar última persona registrada: {str(e)}"

def get_all_people():
    try:
        people = list(collection.find({}, {"primerNombre": 1, "apellidos": 1, "correo": 1}))
        if not people:
            return "No hay personas registradas."
        
        result = "Personas registradas:\n"
        for person in people[:5]:  
            result += f"- {person['primerNombre']} {person['apellidos']}\n"
        
        if len(people) > 5:
            result += f"... y {len(people) - 5} personas más."
            
        return result
    except Exception as e:
        return f"Error al listar personas: {str(e)}"

# Endpoint para procesar consultas
@app.post("/query")
async def process_query(query: str = Body(..., embed=True)):
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
        
        if not context:
            context = get_all_people()
        
        response = chain.run(question=query, context=context)
        
        # Registrar en logs
        registrar_consulta(query, response)
        
        return {"answer": response}
    
    except Exception as e:
        error_msg = f"Error procesando consulta: {str(e)}"
        return {"answer": "Lo siento, no pude procesar tu consulta en este momento."}

@app.get("/health")
async def health_check():
    return {"status": "ok"}