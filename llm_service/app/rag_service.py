from fastapi import FastAPI, HTTPException
from pymongo import MongoClient
from langchain.llms import HuggingFaceHub
from langchain.chains import RetrievalQA

app = FastAPI()
client = MongoClient("mongodb://mongodb:27017/")
db = client["personas"]
collection = db["personas"]

# Configurar LLM + RAG
llm = HuggingFaceHub(repo_id="google/flan-t5-xxl")
qa_chain = RetrievalQA.from_chain_type(llm, retriever=collection.as_retriever())

@app.post("/query")
def process_query(query: str):
    try:
        result = qa_chain.run(query)
        return {"answer": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))