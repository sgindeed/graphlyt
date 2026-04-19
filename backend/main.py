from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import PyPDF2
import io
import uuid
import json

# Internal imports from our custom modules
from db import init_age, save_graph_to_age, get_graph_data, clear_graph
from ai_engine import extract_graph_stream, query_rag_pipeline

app = FastAPI(title="Neural Architect | Core Engine")

# --- SENIOR CONFIG: CORS ---
# Allows your Vite/React frontend to communicate securely with this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory staging area for document text before the WebSocket stream starts
DOCUMENT_STORE = {}

class ChatRequest(BaseModel):
    message: str

# --- LIFECYCLE: BOOT SYSTEM ---
@app.on_event("startup")
def startup_event():
    """Initializes the Graph Database on server start."""
    init_age()

# --- ENDPOINT: RESET CANVAS ---
@app.post("/api/clear")
async def reset_neural_network():
    """Wipes the Apache AGE graph to ensure a clean slate for new manifests."""
    clear_graph()
    return {"status": "success", "message": "Neural graph purged."}

# --- ENDPOINT: INGEST MANIFEST ---
@app.post("/api/upload")
async def upload_document(file: UploadFile = File(...)):
    """Receives PDF, extracts text, and stages it for live streaming."""
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Manifest must be a PDF file.")
    
    try:
        contents = await file.read()
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(contents))
        
        full_text = ""
        for page in pdf_reader.pages:
            extracted = page.extract_text()
            if extracted:
                full_text += extracted + "\n"

        # Create a unique session ID for the WebSocket to hook into
        doc_id = str(uuid.uuid4())
        DOCUMENT_STORE[doc_id] = {
            "filename": file.filename,
            "text": full_text
        }

        return {"status": "staged", "doc_id": doc_id, "filename": file.filename}
        
    except Exception as e:
        print(f"Ingestion Error: {e}")
        raise HTTPException(status_code=500, detail="Neural ingestion failed.")

# --- WEBSOCKET: REAL-TIME NEURAL STREAM ---
@app.websocket("/api/ws/extract/{doc_id}")
async def websocket_extract(websocket: WebSocket, doc_id: str):
    """Streams nodes and edges to the 3D canvas as the AI extracts them."""
    await websocket.accept()
    
    doc_data = DOCUMENT_STORE.get(doc_id)
    if not doc_data:
        await websocket.send_json({"type": "error", "message": "Manifest not found in staging."})
        await websocket.close()
        return

    nodes_to_save = []
    edges_to_save = []

    try:
        # Trigger the streaming AI generator
        for item in extract_graph_stream(doc_data["filename"], doc_data["text"]):
            # Instantly push to frontend for the "live build" effect
            await websocket.send_json(item)
            
            # Buffer the data so we can batch-save it to PostgreSQL at the end
            if item["type"] == "node":
                nodes_to_save.append(item["data"])
            elif item["type"] == "edge":
                edges_to_save.append(item["data"])
        
        # Once stream finishes, persist to Apache AGE
        if nodes_to_save or edges_to_save:
            save_graph_to_age(nodes_to_save, edges_to_save)
            
        await websocket.send_json({
            "type": "done", 
            "nodes_added": len(nodes_to_save),
            "edges_added": len(edges_to_save)
        })
        
    except WebSocketDisconnect:
        print(f"Neural link severed for doc: {doc_id}")
    except Exception as e:
        print(f"Stream Error: {e}")
        await websocket.send_json({"type": "error", "message": str(e)})
    finally:
        # Clean up memory to prevent leaks
        if doc_id in DOCUMENT_STORE:
            del DOCUMENT_STORE[doc_id]
        await websocket.close()

# --- ENDPOINT: NEURAL QUERY (RAG) ---
@app.post("/api/chat")
async def chat_interface(request: ChatRequest):
    """Interfaces with the RAG pipeline to answer questions about the graph."""
    if not request.message:
        raise HTTPException(status_code=400, detail="Query is empty.")
    
    response = query_rag_pipeline(request.message)
    return {"reply": response, "sender": "ARCHITECT"}

# --- ENDPOINT: FETCH STATIC GRAPH ---
@app.get("/api/graph")
async def fetch_network_graph():
    """Returns the full graph state for initial UI syncing."""
    try:
        return get_graph_data()
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to sync neural map.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)