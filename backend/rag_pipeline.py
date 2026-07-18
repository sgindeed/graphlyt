import os
from openai import OpenAI
from vector_store import query_vector_db
from reranking import rerank_chunks_with_llm

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
FAST_LLM = os.environ.get("FAST_LLM", "llama-3.1-8b-instant")

client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=GROQ_API_KEY
)

def query_rag_pipeline(user_query: str) -> dict:
    """Retrieves vectors, performs LLM reranking, and constructs synthesized answer maps."""
    try:
        retrieved_chunks = query_vector_db(user_query, n_results=10)
        if not retrieved_chunks:
            return {"reply": "No context found inside vector cluster maps.", "sources": []}

        best_chunks = rerank_chunks_with_llm(user_query, retrieved_chunks)
        context = "\n\n---\n\n".join(best_chunks)
        prompt = f"Context:\n{context}\n\nQuery: {user_query}\n\nAnswer concisely based ONLY on the context:"
        
        response = client.chat_completion(
            model=FAST_LLM,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=500
        )
        
        return {
            "reply": response.choices[0].message.content.strip(),
            "sources": best_chunks
        }
    except Exception as e:
        print(f"RAG Framework Pipeline Error: {e}")
        return {"reply": "System Error: Neural processing map broke down.", "sources": []}