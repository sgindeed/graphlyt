import numpy as np
from typing import Any, Dict, List
from sentence_transformers import SentenceTransformer
from utils import cosine_similarity

# Initialize a fast, local embedding model (no API key required)
encoder = SentenceTransformer('all-MiniLM-L6-v2')

chunk_embeddings_store: List[Dict[str, Any]] = []

def clear_vector_db():
    """Wipes out cached chunks and embeddings from memory."""
    global chunk_embeddings_store
    chunk_embeddings_store.clear()

async def index_chunks_to_vector_db(combined_chunks: list):
    """Generates local embeddings and adds chunks to the memory store."""
    global chunk_embeddings_store
    if not combined_chunks:
        return
        
    chunk_texts = [c["text"] for c in combined_chunks]
    
    # Generate local embeddings synchronously
    embeddings = encoder.encode(chunk_texts)
    
    for idx, emb in enumerate(embeddings):
        combined_chunks[idx]["embedding"] = np.array(emb)

    chunk_embeddings_store.extend(combined_chunks)

async def query_vector_db(query: str, top_k: int = 4) -> list:
    """Queries the embedding store via cosine similarity."""
    global chunk_embeddings_store
    if not chunk_embeddings_store:
        return []
        
    query_vec = np.array(encoder.encode(query))

    scored = []
    for chunk in chunk_embeddings_store:
        score = cosine_similarity(query_vec, chunk["embedding"])
        scored.append((score, chunk))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [item[1]["text"] for item in scored[:top_k]]
