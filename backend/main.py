from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Application Imports
from routes import router
from db import init_graph

app = FastAPI(title="Neural Architect | Core Engine")

# --- SENIOR CONFIG: CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- LIFECYCLE: BOOT SYSTEM ---
@app.on_event("startup")
def startup_event():
    """Initializes the Graph Database on server start."""
    init_graph()

# --- HEALTH CHECK ---
@app.api_route("/health", methods=["GET", "HEAD"], tags=["Health"])
async def health_check():
    """
    Checks system health status.
    Supports GET for manual checking and HEAD for lightweight uptime monitoring.
    """
    return {
        "status": "healthy",
        "service": "Neural Architect | Core Engine"
    }

# --- MOUNT MODULAR ROUTES ---
app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
