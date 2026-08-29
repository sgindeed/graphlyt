import os
from groq import AsyncGroq
from vector_store import query_vector_db
from db import get_graph_data

groq_client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))

# Migrated to Groq's active 120B model
FAST_LLM = "openai/gpt-oss-120b"

async def query_rag_pipeline(query: str) -> dict:
    retrieved_chunks = await query_vector_db(query, top_k=4)
    
    active_graph = get_graph_data()
    matched_nodes = []
    for node in active_graph.get("nodes", []):
        name = node.get("name", "").lower()
        if name and (name in query.lower() or any(name in c.lower() for c in retrieved_chunks)):
            matched_nodes.append(node)

    context_str = "\n\n".join(retrieved_chunks)

    system_prompt = (
        "You are GRAPHLYT Neural Architect, a data synthesis engine. "
        "Answer the user query concisely using provided document context and entity references. "
        "Use **bold text** for primary entities, definitions, and pivotal keywords."
    )

    user_prompt = f"Context:\n{context_str}\n\nQuery: {query}"

    completion = await groq_client.chat.completions.create(
        model=FAST_LLM,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.3
    )

    answer = completion.choices[0].message.content or ""

    return {
        "reply": answer,
        "sources": retrieved_chunks[:2],
        "retrieved": retrieved_chunks,
        "nodes": matched_nodes
    }
