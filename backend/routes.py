from fastapi import APIRouter, UploadFile, File, WebSocket, WebSocketDisconnect, HTTPException
from typing import List
import PyPDF2
import io
import uuid

# Isolate Data and State
from models import ChatRequest
from state import DOCUMENT_STORE

# Core Engine Pipelines
from db import save_graph_data, get_graph_data, clear_graph
from vector_store import index_document_to_vector_db, clear_vector_db
from graph_extractor import extract_graph_stream
from rag_pipeline import query_rag_pipeline

router = APIRouter()

@router.post("/api/clear")
async def reset_neural_network():
    """Wipes the NetworkX graph and Chroma DB matrices."""
    clear_graph()
    clear_vector_db()
    return {"status": "success", "message": "Neural graph and vector matrices purged."}

@router.post("/api/upload")
async def upload_documents(files: List[UploadFile] = File(...)):
    """Accepts multiple manifest payloads, parses text collections, maps vector spaces."""
    batch_id = str(uuid.uuid4())
    DOCUMENT_STORE[batch_id] = []
    total_chunks = 0
    
    try:
        for file in files:
            if not file.filename.lower().endswith('.pdf'):
                continue
                
            contents = await file.read()
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(contents))
            
            file_text = ""
            for page in pdf_reader.pages:
                extracted = page.extract_text()
                if extracted:
                    file_text += extracted + "\n"

            if file_text.strip():
                # Append chunks directly to vector collection room
                chunks_added = index_document_to_vector_db(batch_id, file_text)
                total_chunks += chunks_added
                
                DOCUMENT_STORE[batch_id].append({
                    "filename": file.filename,
                    "text": file_text
                })

        if not DOCUMENT_STORE[batch_id]:
            raise HTTPException(status_code=400, detail="No valid text extracted from files.")

        return {
            "status": "staged", 
            "doc_id": batch_id, 
            "file_count": len(DOCUMENT_STORE[batch_id]),
            "chunk_count": total_chunks
        }
        
    except Exception as e:
        print(f"Batch Multi-Ingestion Error: {e}")
        raise HTTPException(status_code=500, detail="Neural batch ingestion failed.")

@router.websocket("/api/ws/extract/{batch_id}")
async def websocket_extract(websocket: WebSocket, batch_id: str):
    """Iteratively processes staged batch text streams via open WebSocket channels."""
    await websocket.accept()
    
    staged_docs = DOCUMENT_STORE.get(batch_id)
    if not staged_docs:
        await websocket.send_json({"type": "error", "message": "Batch manifest missing from cache."})
        await websocket.close()
        return

    nodes_to_save, edges_to_save = [], []

    try:
        # Loop through each uploaded document sequentially over the stream
        for doc in staged_docs:
            for item in extract_graph_stream(doc["filename"], doc["text"]):
                await websocket.send_json(item)
                if item["type"] == "node":
                    nodes_to_save.append(item["data"])
                elif item["type"] == "edge":
                    edges_to_save.append(item["data"])
        
        if nodes_to_save or edges_to_save:
            save_graph_data(nodes_to_save, edges_to_save)
            
        await websocket.send_json({
            "type": "done", 
            "nodes_added": len(nodes_to_save),
            "edges_added": len(edges_to_save)
        })
        
    except WebSocketDisconnect:
        pass
    except Exception as e:
        await websocket.send_json({"type": "error", "message": str(e)})
    finally:
        # Prevent memory leaks by cleaning up the staging dictionary
        if batch_id in DOCUMENT_STORE:
            del DOCUMENT_STORE[batch_id]
        await websocket.close()

@router.post("/api/chat")
async def chat_interface(request: ChatRequest):
    """Interfaces with the RAG pipeline using Chroma DB and the reasoning LLM."""
    if not request.message:
        raise HTTPException(status_code=400, detail="Query is empty.")
    
    rag_response = query_rag_pipeline(request.message)
    return rag_response

@router.get("/api/graph")
async def fetch_network_graph():
    """Returns the full NetworkX graph state for initial UI syncing."""
    return get_graph_data()