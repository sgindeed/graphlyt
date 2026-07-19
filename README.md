# GRAPHLYT: Neural Architect

<p align="center">

# GRAPHLYT
### Transforming Documents into Living Knowledge Graphs

AI-powered Knowledge Graph Generation • Real-time Streaming • Interactive Graph Visualization • Retrieval-Augmented Generation

</p>

<p align="center">

![GitHub repo size](https://img.shields.io/github/repo-size/sgindeed/GRAPHLYT?style=for-the-badge)
![GitHub stars](https://img.shields.io/github/stars/sgindeed/GRAPHLYT?style=for-the-badge)
![GitHub forks](https://img.shields.io/github/forks/sgindeed/GRAPHLYT?style=for-the-badge)
![GitHub issues](https://img.shields.io/github/issues/sgindeed/GRAPHLYT?style=for-the-badge)
![GitHub last commit](https://img.shields.io/github/last-commit/sgindeed/GRAPHLYT?style=for-the-badge)

</p>

<p align="center">

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Mantine](https://img.shields.io/badge/Mantine-339AF0?style=flat-square&logo=mantine&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Groq](https://img.shields.io/badge/Groq-LLM-00A67E?style=flat-square)
![LangChain](https://img.shields.io/badge/LangChain-AI-success?style=flat-square)
![NetworkX](https://img.shields.io/badge/NetworkX-Graph%20Engine-orange?style=flat-square)
![WebSockets](https://img.shields.io/badge/WebSockets-Live%20Streaming-purple?style=flat-square)
![MIT License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

</p>

---

# Overview

GRAPHLYT is a **high-performance AI-powered Knowledge Graph platform** designed to bridge the gap between **unstructured documents** and **structured semantic knowledge**.

Instead of treating PDFs as plain text, GRAPHLYT automatically discovers entities, identifies relationships, constructs an interconnected knowledge graph, and streams the graph live to an interactive visualization interface.

The platform combines **Large Language Models**, **NetworkX**, **LangChain**, and **FastAPI** to generate complex semantic graphs in real time while simultaneously enabling intelligent Retrieval-Augmented Generation (RAG) over the ingested documents.

Whether you're exploring historical documents, research papers, technical manuals, legal records, or organizational reports, GRAPHLYT converts static information into an interactive network of knowledge.

---

# Key Features

- AI-powered Knowledge Graph Generation
- Real-time Graph Construction
- Live WebSocket Streaming
- Intelligent Entity Extraction
- Automatic Relationship Discovery
- Entity Normalization Engine
- Duplicate Detection & Removal
- Interactive Force-Directed Graph
- Largest Cluster Auto-Focus
- Physics-Based Graph Simulation
- Session-aware RAG Chat
- Context-Aware Question Answering
- Fast Async Backend
- Modern React Frontend
- Modular Architecture
- Scalable Processing Pipeline
- Progressive Graph Rendering

---

# System Architecture

```
                     PDF Upload
                          │
                          ▼
                 FastAPI Backend
                          │
                          ▼
             LangChain Document Splitter
                          │
                          ▼
            Groq LLM Entity Extraction
                          │
        ┌─────────────────┴─────────────────┐
        ▼                                   ▼
 Entity Identification              Relation Discovery
        │                                   │
        └───────────────┬───────────────────┘
                        ▼
            Entity Normalization Engine
                        │
                        ▼
             Deduplication Pipeline
                        │
                        ▼
          NetworkX Knowledge Graph
                        │
                        ▼
         Real-time WebSocket Streaming
                        │
                        ▼
         Interactive React Visualization
                        │
                        ▼
             Retrieval-Augmented Chat
```

---

# Technology Stack

## Backend

| Technology | Purpose |
|------------|----------|
| Python 3.11 | Core Language |
| FastAPI | REST API & WebSocket Server |
| Groq API | LLM Inference |
| LangChain | Document Processing |
| NetworkX | Graph Construction |
| AsyncIO | Concurrent Execution |
| WebSockets | Live Graph Streaming |
| Pydantic | Data Validation |
| Uvicorn | ASGI Server |

---

## Frontend

| Technology | Purpose |
|------------|----------|
| React (Vite) | User Interface |
| Mantine UI | Component Library |
| Tailwind CSS | Styling |
| React Force Graph 2D | Graph Rendering |
| Canvas API | High-performance Drawing |
| D3 Force Simulation | Graph Physics |

---

# Knowledge Graph Engine

The Knowledge Graph Engine is the heart of GRAPHLYT.

Unlike conventional search engines that simply retrieve matching text, GRAPHLYT constructs a semantic network where every entity becomes a node and every discovered relationship becomes an edge.

The resulting graph represents knowledge rather than documents.

---

## Entity Extraction

The Groq-powered LLM identifies meaningful entities from every document chunk.

Supported entity categories include

- Person
- Organization
- Location
- Technology
- Event
- Concept

Example

```

Cristiano Ronaldo

Portugal National Team

Real Madrid

UEFA Champions League

Ballon d'Or

Al Nassr FC

```

---

## Relationship Extraction

The model simultaneously identifies semantic relationships between entities.

Example

```
Ronaldo
      played_in
          ↓
Manchester United

Ronaldo
      won
            ↓
Puskas Award

Lisbon
        capital_of
                ↓
Portugal
```

These relationships become graph edges.

---

# Entity Normalization

One of the biggest challenges in automatic graph generation is duplicate entities.

For example

```
Ronaldo

Cristiano Ronaldo

RONALDO
```

Without normalization these become three different nodes.

GRAPHLYT solves this using an internal normalization pipeline.

Example

```
Cristiano Ronaldo

↓

cristiano_ronaldo
```

Normalization includes

- Lowercase conversion
- Whitespace replacement
- Special character removal
- Stable graph identifiers
- Consistent references

This guarantees that every real-world entity exists only once within the graph.

---

# Intelligent Deduplication

The extraction pipeline continuously maintains

```
seen_nodes

seen_edges
```

Every incoming node and edge is verified before being added.

Benefits

- Eliminates duplicate nodes
- Prevents fragmented graphs
- Faster rendering
- Lower memory usage
- Cleaner visualizations

---

# Graph Construction using NetworkX

GRAPHLYT leverages **NetworkX** as its graph processing engine.

NetworkX is responsible for

- Graph construction
- Node management
- Edge creation
- Connectivity analysis
- Largest connected component detection
- Graph traversal
- Internal graph operations

Using NetworkX allows the backend to efficiently maintain a consistent and connected semantic graph before streaming it to the frontend.

---

# AI Processing Pipeline

## 1. Document Ingestion

Users upload PDF documents through the frontend.

FastAPI receives and validates the uploaded file.

---

## 2. Semantic Chunking

The document is divided using LangChain's

```
RecursiveCharacterTextSplitter
```

This preserves semantic meaning while ensuring each chunk fits within the LLM context window.

---

## 3. LLM Entity Extraction

Each chunk is independently processed using the Groq API.

The model extracts

- Entities
- Relationships
- Entity Types
- Relation Labels

---

## 4. Schema Validation

Every response is validated using a strict JSON schema.

```
{
    id,
    name,
    type,
    source,
    target,
    relation
}
```

Invalid responses are discarded.

---

## 5. Graph Construction

Validated nodes and relationships are merged into the NetworkX graph.

Normalization and deduplication occur during this stage.

---

## 6. Live Streaming

Verified nodes and edges are streamed to the frontend over WebSockets.

The user watches the graph grow in real time.

---

## 7. Interactive Visualization

The frontend immediately renders the streamed graph using a force-directed layout.

---

# Retrieval-Augmented Generation (RAG)

GRAPHLYT includes an intelligent document assistant powered by Retrieval-Augmented Generation.

Instead of directly querying the LLM, GRAPHLYT retrieves the most relevant document context before generating a response.

Workflow

```
User Question

↓

Retrieve Relevant Context

↓

Build Prompt

↓

Groq LLM

↓

Grounded Answer
```

This dramatically reduces hallucinations and produces accurate, document-grounded responses.

---

# Real-time Streaming

Unlike traditional graph generators that wait until processing completes, GRAPHLYT progressively streams results.

```
PDF

↓

Chunk 1

↓

Extract

↓

Node

↓

Frontend

↓

Chunk 2

↓

Extract

↓

Edge

↓

Frontend

↓

Chunk 3

↓

Graph Continues Growing...
```

This enables users to interact with the graph while extraction is still running.

---

# Fault Tolerance

To improve reliability during large document ingestion, GRAPHLYT includes an automatic retry mechanism.

Features include

- Exponential Backoff
- Automatic Retry
- API Rate Limit Recovery
- Continuous Processing

Retry sequence

```
5 Seconds

10 Seconds

20 Seconds

40 Seconds
```

---

# Graph Visualization

The frontend provides an interactive graph exploration experience.

Capabilities include

- Zoom
- Pan
- Node Dragging
- Live Updates
- Automatic Graph Centering
- Largest Cluster Focus
- Force Simulation
- Smooth Animations
- Color-coded Entity Types

---

## Entity Colors

| Entity | Color |
|---------|--------|
| Person | `#8b5cf6` |
| Organization | `#3b82f6` |
| Location | `#10b981` |
| Concept | `#f59e0b` |
| Event | `#ec4899` |
| Technology | `#6366f1` |

---

# Installation

## Clone Repository

```bash
git clone https://github.com/sgindeed/graphlyt.git

cd graphlyt
```

---

# Backend Setup

```bash
cd backend
```

Install dependencies

```bash
pip install -r requirements.txt
```

Create `.env`

```env
GROQ_API_KEY=your_groq_api_key
```

Run

```bash
uvicorn main:app --reload
```

---

# Frontend Setup

```bash
cd frontend
```

Install packages

```bash
npm install
```

Create `.env`

```env
VITE_API_BASE=http://localhost:8000

VITE_WS_BASE=ws://localhost:8000
```

Run

```bash
npm run dev
```

---

# Deployment

## Backend

Platform

- Render

Build Command

```bash
pip install -r requirements.txt
```

Start Command

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT --ws websockets
```

Environment Variable

```env
GROQ_API_KEY=xxxxxxxxxxxxxxxx
```

---

## Frontend

Recommended Platforms

- Vercel
- Netlify

Environment Variables

```env
VITE_API_BASE=https://your-backend-url

VITE_WS_BASE=wss://your-backend-url
```

---

# Project Structure

```
GRAPHLYT

├── backend
│   ├── main.py
│   ├── ai_engine.py
│   ├── graph.py
│   ├── rag.py
│   ├── websocket.py
│   ├── requirements.txt
│   └── ...
│
├── frontend
│   ├── src
│   ├── public
│   ├── package.json
│   └── ...
│
└── README.md
```

---

# Performance Highlights

- Fully Asynchronous Backend
- FastAPI-based REST & WebSockets
- Groq Ultra-low Latency Inference
- NetworkX Graph Processing
- Intelligent Entity Deduplication
- Automatic Entity Normalization
- Incremental Graph Rendering
- Session-aware RAG
- Modular Codebase
- High-performance Streaming Architecture

---

# Future Roadmap

- 3D Knowledge Graph
- Multi-document Graph Fusion
- Neo4j Integration
- Graph Analytics
- Community Detection
- Graph Search
- Cypher Query Support
- Graph Export (GraphML, GEXF)
- User Authentication
- Collaborative Sessions
- Graph Versioning

---

# Contributing

Contributions are welcome.

To contribute

1. Fork the repository.
2. Create a feature branch.
3. Commit your changes.
4. Open a Pull Request.

Please ensure all contributions preserve the existing normalization, deduplication, and streaming architecture.

---

<p align="center">

### GRAPHLYT

**Building semantic intelligence from unstructured documents through AI-powered Knowledge Graphs.**

</p>
