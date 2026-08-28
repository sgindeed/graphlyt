import io
import uuid
import asyncio
from fastapi import APIRouter, File, UploadFile, WebSocket, WebSocketDisconnect, HTTPException
from typing import List
from pypdf import PdfReader

from models import ChatRequest
from state import DOCUMENT_STORE
from db import clear_graph, set_graph_data, get_graph_data
from vector_store import clear_vector_db, index_chunks_to_vector_db
from chunking import chunk_text
from graph_extractor import extract_graph_xml
from rag_pipeline import query_rag_pipeline

router = APIRouter()

@router.post("/api/clear")
async def reset_neural_network():
    """Wipes the graph and vector matrices."""
    clear_graph()
    clear_vector_db()
    DOCUMENT_STORE.clear()
    return {"status": "cleared"}

@router.post("/api/upload")
async def upload_documents(files: List[UploadFile] = File(...)):
    """Accepts payloads, parses text, and maps vector spaces."""
    doc_id = str(uuid.uuid4())
    processed_files = []
    combined_chunks = []

    try:
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

            chunks = chunk_text(extracted_text)
            
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

        await index_chunks_to_vector_db(combined_chunks)

        DOCUMENT_STORE[doc_id] = {
            "files": processed_files,
            "chunks": combined_chunks
        }

        return {
            "doc_id": doc_id,
            "file_count": len(processed_files),
            "chunk_count": len(combined_chunks),
            "files": processed_files
        }

    except Exception as e:
        print(f"Batch Multi-Ingestion Error: {e}")
        raise HTTPException(status_code=500, detail="Neural batch ingestion failed.")

@router.websocket("/api/ws/extract/{doc_id}")
async def websocket_extract(websocket: WebSocket, doc_id: str):
    """Processes staged batch streams via open channels."""
    await websocket.accept()

    if doc_id not in DOCUMENT_STORE:
        await websocket.send_json({"type": "error", "message": "Document session not found."})
        await websocket.close()
        return

    doc_data = DOCUMENT_STORE[doc_id]
    all_text = "\n\n".join([c["text"] for c in doc_data["chunks"][:10]])

    try:
        parsed = await extract_graph_xml(all_text)

        unique_nodes = {n["id"]: n for n in parsed["nodes"]}.values()
        nodes_list = list(unique_nodes)
        edges_list = parsed["edges"]

        set_graph_data(nodes_list, edges_list)

        # Stream Nodes
        for node in nodes_list:
            await websocket.send_json({"type": "node", "data": node})
            await asyncio.sleep(0.04)

        # Stream Edges
        for edge in edges_list:
            await websocket.send_json({"type": "edge", "data": edge})
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

@router.post("/api/chat")
async def chat_interface(request: ChatRequest):
    """Interfaces with the RAG pipeline."""
    if not request.message:
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    return await query_rag_pipeline(request.message)

@router.get("/api/graph")
async def fetch_network_graph():
    """Returns the full graph state."""
    return get_graph_data()
