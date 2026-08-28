import os
import numpy as np
from typing import Any, Dict, List
from openai import AsyncOpenAI
from utils import cosine_similarity

openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", "your-openai-api-key"))
chunk_embeddings_store: List[Dict[str, Any]] = []

def clear_vector_db():
    """Wipes out cached chunks and embeddings from memory."""
    global chunk_embeddings_store
    chunk_embeddings_store.clear()

async def index_chunks_to_vector_db(combined_chunks: list):
    """Generates embeddings and adds chunks to the memory store."""
    global chunk_embeddings_store
    if not combined_chunks:
        return
        
    chunk_texts = [c["text"] for c in combined_chunks]
    emb_res = await openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=chunk_texts
    )
    for idx, item in enumerate(emb_res.data):
        combined_chunks[idx]["embedding"] = np.array(item.embedding)

    chunk_embeddings_store.extend(combined_chunks)

async def query_vector_db(query: str, top_k: int = 4) -> list:
    """Queries the embedding store via cosine similarity."""
    global chunk_embeddings_store
    if not chunk_embeddings_store:
        return []
        
    query_emb_res = await openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=[query]
    )
    query_vec = np.array(query_emb_res.data[0].embedding)

    scored = []
    for chunk in chunk_embeddings_store:
        score = cosine_similarity(query_vec, chunk["embedding"])
        scored.append((score, chunk))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [item[1]["text"] for item in scored[:top_k]]
