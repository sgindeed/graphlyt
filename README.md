# GRAPHLYT: Neural Architect

GRAPHLYT is a sophisticated Knowledge Graph platform that uses Large Language Models (LLMs) to ingest unstructured PDF data, extract entities and relationships in real-time, and visualize them in a dynamic 3D space. It features an integrated RAG (Retrieval-Augmented Generation) chat interface for querying the ingested data.

---

## 🚀 Key Features

- **Real-time Neural Streaming**  
  Uses WebSockets to stream extracted nodes and edges directly to the 3D canvas as the AI processes the text.

- **3D Force-Directed Graph**  
  An interactive visualization built with Three.js and React, allowing users to explore complex relationships spatially.

- **Apache AGE Integration**  
  Leverages Graph-on-PostgreSQL for robust storage and querying of complex network data.

- **AI-Powered RAG Chat**  
  A built-in "Architect" agent that answers questions based on the ingested document context.

- **Dynamic HUD & Filtering**  
  Real-time statistics, node search, and physics controls for the visualization.

---

## 🛠️ Tech Stack

### Backend
- **FastAPI** – High-performance Python web framework for the core API  
- **Apache AGE / PostgreSQL** – Graph database extension for managing entities and relationships  
- **Hugging Face** – Powers the Llama-4-Maverick-17B model for graph extraction and chat  
- **WebSockets** – Enables real-time data streaming from AI to frontend  

### Frontend
- **React (Vite)** – Modern frontend framework for responsive UI  
- **react-force-graph-3d** – 3D graph visualization built on Three.js  
- **Mantine UI & Tailwind CSS** – Clean UI components and layout styling  
- **Lucide React** – Modern icon library  

---

## 📁 Project Structure

```

/ (Root)
├── backend/
│   ├── main.py         # FastAPI endpoints and WebSocket logic
│   ├── db.py           # Apache AGE initialization and graph operations
│   ├── ai_engine.py    # LLM integration and graph extraction logic
│   └── wiki_data/      # Local storage for ingested text chunks
├── frontend/
│   ├── src/
│   │   └── App.jsx     # Main React application and 3D visualization
│   ├── public/
│   │   └── _redirects  # Netlify SPA routing configuration
│   └── package.json    # Frontend dependencies
├── Dockerfile          # Containerization for backend deployment
└── start.sh            # Startup script for Postgres and FastAPI

````

---

## ⚙️ Setup & Installation

### Prerequisites
- Python 3.11+
- Node.js & npm
- PostgreSQL with Apache AGE extension (for local setup)

---

### Backend Configuration

1. Navigate to the `backend` directory  
2. Install dependencies:
   ```bash
   pip install -r requirements.txt

3. Configure `.env` file:

   ```env
   HF_TOKEN=your_huggingface_token
   DATABASE_URL=postgresql://user:pass@localhost:5432/knowledge_graph_db
   ```
4. Run the server:

   ```bash
   uvicorn main:app --reload
   ```

---

### Frontend Configuration

1. Navigate to the `frontend` directory
2. Install dependencies:

   ```bash
   npm install
   ```
3. Configure environment variables:

   ```env
   VITE_API_BASE=your_backend_api_url
   VITE_WS_BASE=your_websocket_url
   ```
4. Run locally:

   ```bash
   npm run dev
   ```

---

## 🌐 Deployment

### Backend (Render)

* Uses a custom Docker image to support Apache AGE
* Deployed as a Web Service on Render
* Startup script initializes PostgreSQL and FastAPI together

### Frontend (Netlify)

* **Base Directory:** `frontend`

* **Build Command:** `npm run build`

* **Publish Directory:** `dist`

* Includes `_redirects` file for SPA routing:

  ```
  /*    /index.html   200
  ```

---

## 👨‍💻 Author

Made with ❤️ by **Supratim**
