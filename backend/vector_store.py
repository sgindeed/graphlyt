import os
import requests
import time
import numpy as np
from typing import Any, Dict, List
from utils import cosine_similarity

HF_TOKEN = os.getenv("HF_TOKEN", "your_huggingface_token")
# Updated to standard model inference URL
API_URL = "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2"
HEADERS = {"Authorization": f"Bearer {HF_TOKEN}"}

chunk_embeddings_store: List[Dict[str, Any]] = []

def clear_vector_db():
    global chunk_embeddings_store
    chunk_embeddings_store.clear()

def _get_cloud_embeddings(texts: list) -> list:
    """Fetches embeddings with a retry loop to survive Render DNS/network blips."""
    max_retries = 3
    for attempt in range(max_retries):
        try:
            # 15-second timeout prevents the thread from hanging indefinitely
            response = requests.post(API_URL, headers=HEADERS, json={"inputs": texts}, timeout=15)
            
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 503:
                # Hugging Face serverless models sleep when inactive. 
                # A 503 means it is waking up. Wait and retry.
                time.sleep(5)
                continue
            else:
                print(f"HF API Error {response.status_code}: {response.text}")
                time.sleep(2)
                
        except requests.exceptions.RequestException as e:
            print(f"Network glitch (Attempt {attempt + 1}/{max_retries}): {e}")
            time.sleep(2)
            
    # Fallback to zero-vectors if all retries fail, ensuring the app doesn't fatally crash
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
