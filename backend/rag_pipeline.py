import os
from openai import AsyncOpenAI
from vector_store import query_vector_db
from db import get_graph_data

openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", "your-openai-api-key"))

async def query_rag_pipeline(query: str) -> dict:
    """Retrieves vectors, synthesizes a grounded answer, and maps utilized nodes."""
    retrieved_chunks = await query_vector_db(query, top_k=4)
    
    # Match relevant graph nodes
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

    completion = await openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
    )

    answer = completion.choices[0].message.content or ""

    return {
        "reply": answer,
        "sources": retrieved_chunks[:2],
        "retrieved": retrieved_chunks,
        "nodes": matched_nodes
    }
