import os
import re
from groq import Groq
from vector_store import query_vector_db
from reranking import rerank_chunks_with_llm
import db

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
FAST_LLM = os.environ.get("FAST_LLM", "llama-3.1-8b-instant")

# Initialize the native Groq client
client = Groq(api_key=GROQ_API_KEY)

# Session memory to retain context between iterative queries
chat_memory = []

def clear_chat_memory():
    """Flushes the active session memory."""
    global chat_memory
    chat_memory = []

def query_rag_pipeline(user_query: str) -> dict:
    """Retrieves vectors, reranks them, synthesizes a grounded answer using session memory, 
    and strictly maps the specific graph nodes the LLM utilized.
    """
    global chat_memory
    
    try:
        retrieved_chunks = query_vector_db(user_query, n_results=10)
        if not retrieved_chunks:
            return {
                "reply": "No relevant context was found in the indexed documents.", 
                "sources": [], 
                "retrieved": [],
                "nodes": []
            }

        reranked = rerank_chunks_with_llm(user_query, retrieved_chunks, top_k=5)
        context = "\n\n---\n\n".join(item["text"] for item in reranked)

        system_instruction = (
            "You are an AI assistant for a knowledge graph. "
            "Use the provided context to answer the user's question accurately. "
            "Cover every relevant detail present in the context. "
            f"Context:\n{context}"
        )

        # Build message history array starting with the core directive
        messages = [{"role": "system", "content": system_instruction}]
        
        # Inject the recent conversational memory (limits to last 3 full interactions)
        messages.extend(chat_memory[-6:])
        
        # Add the current user instruction
        messages.append({"role": "user", "content": user_query})

        response = client.chat.completions.create(
            model=FAST_LLM,
            messages=messages,
            # max_tokens=1200,
            temperature=0.3
        )
        
        reply_text = response.choices[0].message.content.strip()

        # Update the memory buffer
        chat_memory.append({"role": "user", "content": user_query})
        chat_memory.append({"role": "assistant", "content": reply_text})

        # STRICT PROVENANCE: Map entities present ONLY in the final LLM reply
        used_nodes = []
        try:
            reply_lower = reply_text.lower()
            for node_id, data in db.G.nodes(data=True):
                node_name = str(data.get("name", node_id))
                
                # Increase noise filter to ignore 1-2 character node anomalies 
                if node_name and len(node_name) > 2:
                    # Escape special characters in the node name to prevent regex compilation errors
                    escaped_name = re.escape(node_name.lower())
                    
                    # \b ensures we only match whole words
                    pattern = rf"\b{escaped_name}\b"
                    
                    if re.search(pattern, reply_lower):
                        used_nodes.append({
                            "id": node_id,
                            "name": node_name,
                            "type": data.get("type", "Entity")
                        })
        except Exception as graph_err:
            print(f"Error mapping graph nodes to RAG context: {graph_err}")

        return {
            "reply": reply_text,
            "sources": reranked,
            "retrieved": [{"text": c, "original_rank": i} for i, c in enumerate(retrieved_chunks)],
            "nodes": used_nodes
        }
    except Exception as e:
        print(f"RAG Framework Pipeline Error: {e}")
        return {
            "reply": "System Error: Neural processing map broke down.", 
            "sources": [], 
            "retrieved": [],
            "nodes": []
        }