import asyncio
import io
import os
import re
import uuid
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI
from pydantic import BaseModel
from pypdf import PdfReader

app = FastAPI(title="Graphlyt Neural Architect Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", "your-openai-api-key"))

# In-memory storage state
document_store: Dict[str, Dict[str, Any]] = {}
active_graph: Dict[str, Any] = {"nodes": [], "links": []}
chunk_embeddings_store: List[Dict[str, Any]] = []


class ChatRequest(BaseModel):
    message: str


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def clean_xml_string(raw_content: str) -> str:
    """Extracts XML block if enclosed in markdown code fences or tags."""
    match = re.search(r"```(?:xml)?\s*(<graph>.*?</graph>)\s*```", raw_content, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    match = re.search(r"(<graph>.*?</graph>)", raw_content, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return raw_content.strip()


def parse_graph_xml(xml_content: str) -> Dict[str, List[Dict[str, Any]]]:
    """Parses graph nodes and edges from structured XML."""
    cleaned = clean_xml_string(xml_content)
    nodes = []
    edges = []

    try:
        root = ET.fromstring(cleaned)

        # Parse Nodes
        nodes_tag = root.find("nodes")
        if nodes_tag is not None:
            for n in nodes_tag.findall("node"):
                node_id = n.get("id") or n.findtext("id")
                node_name = n.get("name") or n.findtext("name") or node_id
                node_type = n.get("type") or n.findtext("type") or "Concept"
                
                if node_id:
                    nodes.append({
                        "id": node_id.strip(),
                        "name": node_name.strip() if node_name else node_id.strip(),
                        "type": node_type.strip()
                    })

        # Parse Edges
        edges_tag = root.find("edges")
        if edges_tag is not None:
            for e in edges_tag.findall("edge"):
                source = e.get("source") or e.findtext("source")
                target = e.get("target") or e.findtext("target")
                label = e.get("label") or e.findtext("label") or "RELATES_TO"

                if source and target:
                    edges.append({
                        "source": source.strip(),
                        "target": target.strip(),
                        "label": label.strip()
                    })

    except ET.ParseError:
        # Fallback regex extraction for malformed XML
        for n_match in re.finditer(r'<node\s+id=["\'](.*?)["\']\s+name=["\'](.*?)["\']\s+type=["\'](.*?)["\']\s*/>', cleaned):
            nodes.append({
                "id": n_match.group(1).strip(),
                "name": n_match.group(2).strip(),
                "type": n_match.group(3).strip()
            })

        for e_match in re.finditer(r'<edge\s+source=["\'](.*?)["\']\s+target=["\'](.*?)["\']\s*(?:label=["\'](.*?)["\'])?\s*/>', cleaned):
            edges.append({
                "source": e_match.group(1).strip(),
                "target": e_match.group(2).strip(),
                "label": (e_match.group(3) or "RELATES_TO").strip()
            })

    return {"nodes": nodes, "edges": edges}


@app.post("/api/clear")
async def clear_state():
    global active_graph, document_store, chunk_embeddings_store
    active_graph = {"nodes": [], "links": []}
    document_store.clear()
    chunk_embeddings_store.clear()
    return {"status": "cleared"}


@app.post("/api/upload")
async def upload_documents(files: List[UploadFile] = File(...)):
    global document_store, chunk_embeddings_store
    doc_id = str(uuid.uuid4())
    processed_files = []
    combined_chunks = []

    for file in files:
        content = await file.read()
        extracted_text = ""

        if file.filename.lower().endswith(".pdf"):
            reader = PdfReader(io.BytesIO(content))
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    extracted_text += text + "\n"
        else:
            extracted_text = content.decode("utf-8", errors="ignore")

        # Sliding window chunking
        words = extracted_text.split()
        chunk_size = 350
        overlap = 50
        chunks = []

        for i in range(0, len(words), chunk_size - overlap):
            chunk = " ".join(words[i:i + chunk_size])
            if chunk.strip():
                chunks.append(chunk)

        processed_files.append({
            "filename": file.filename,
            "chunk_count": len(chunks)
        })

        for idx, chunk in enumerate(chunks):
            combined_chunks.append({
                "text": chunk,
                "filename": file.filename,
                "chunk_index": idx
            })

    # Generate Embeddings for Vector Search
    if combined_chunks:
        chunk_texts = [c["text"] for c in combined_chunks]
        emb_res = await openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=chunk_texts
        )
        for idx, item in enumerate(emb_res.data):
            combined_chunks[idx]["embedding"] = np.array(item.embedding)

        chunk_embeddings_store.extend(combined_chunks)

    document_store[doc_id] = {
        "files": processed_files,
        "chunks": combined_chunks
    }

    return {
        "doc_id": doc_id,
        "file_count": len(processed_files),
        "chunk_count": len(combined_chunks),
        "files": processed_files
    }


@app.websocket("/api/ws/extract/{doc_id}")
async def websocket_extract(websocket: WebSocket, doc_id: str):
    await websocket.accept()
    global active_graph

    if doc_id not in document_store:
        await websocket.send_json({"type": "error", "message": "Document session not found."})
        await websocket.close()
        return

    doc_data = document_store[doc_id]
    all_text = "\n\n".join([c["text"] for c in doc_data["chunks"][:10]])

    prompt = f"""Extract a structured knowledge graph from the text below.
Format the output strictly as XML conforming to this template:
<graph>
  <nodes>
    <node id="UniqueEntityID" name="Entity Name" type="Person|Organization|Location|Concept|Event|Technology"/>
  </nodes>
  <edges>
    <edge source="UniqueEntityID" target="UniqueEntityID" label="RELATION_NAME"/>
  </edges>
</graph>

Text:
{all_text}
"""

    try:
        # LLM call without temperature parameter
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a graph extraction engine that outputs strictly in XML format."},
                {"role": "user", "content": prompt}
            ]
        )

        xml_output = response.choices[0].message.content or ""
        parsed = parse_graph_xml(xml_output)

        unique_nodes = {n["id"]: n for n in parsed["nodes"]}.values()
        nodes_list = list(unique_nodes)
        edges_list = parsed["edges"]

        active_graph["nodes"] = nodes_list
        active_graph["links"] = edges_list

        # Stream all nodes first
        for node in nodes_list:
            await websocket.send_json({
                "type": "node",
                "data": node
            })
            await asyncio.sleep(0.04)

        # Stream all edges sequentially after all nodes are emitted
        for edge in edges_list:
            await websocket.send_json({
                "type": "edge",
                "data": edge
            })
            await asyncio.sleep(0.06)

        await websocket.send_json({"type": "done"})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        await websocket.send_json({"type": "error", "message": str(e)})
    finally:
        try:
            await websocket.close()
        except RuntimeError:
            pass


@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    global chunk_embeddings_store, active_graph
    query = request.message.strip()

    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    retrieved_chunks = []
    
    # Vector Search
    if chunk_embeddings_store:
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
        retrieved_chunks = [item[1]["text"] for item in scored[:4]]

    # Match relevant graph nodes
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

    # LLM completion without temperature parameter
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
