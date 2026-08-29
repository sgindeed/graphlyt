import os
import requests
import numpy as np
from typing import Any, Dict, List
from utils import cosine_similarity

HF_TOKEN = os.getenv("HF_TOKEN", "your_huggingface_token")
API_URL = "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2"
HEADERS = {"Authorization": f"Bearer {HF_TOKEN}"}

chunk_embeddings_store: List[Dict[str, Any]] = []

def clear_vector_db():
    global chunk_embeddings_store
    chunk_embeddings_store.clear()

def _get_cloud_embeddings(texts: list) -> list:
    response = requests.post(API_URL, headers=HEADERS, json={"inputs": texts})
    if response.status_code == 200:
        return response.json()
    return [np.zeros(384).tolist() for _ in texts]

async def index_chunks_to_vector_db(combined_chunks: list):
    global chunk_embeddings_store
    if not combined_chunks:
        return
        
    chunk_texts = [c["text"] for c in combined_chunks]
    embeddings = _get_cloud_embeddings(chunk_texts)
    
    for idx, emb in enumerate(embeddings):
        combined_chunks[idx]["embedding"] = np.array(emb)

    chunk_embeddings_store.extend(combined_chunks)

async def query_vector_db(query: str, top_k: int = 4) -> list:
    global chunk_embeddings_store
    if not chunk_embeddings_store:
        return []
        
    query_emb = _get_cloud_embeddings([query])[0]
    query_vec = np.array(query_emb)

    scored = []
    for chunk in chunk_embeddings_store:
        score = cosine_similarity(query_vec, chunk["embedding"])
        scored.append((score, chunk))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [item[1]["text"] for item in scored[:top_k]]
