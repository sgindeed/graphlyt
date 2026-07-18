import chromadb
from chunking import chunk_text

chroma_client = chromadb.Client()
try:
    collection = chroma_client.create_collection(name="neural_architect_docs")
except chromadb.errors.UniqueConstraintError:
    collection = chroma_client.get_collection(name="neural_architect_docs")

def index_document_to_vector_db(doc_id: str, text: str) -> int:
    """Chunks the text block and embeds it inside Chroma DB collection."""
    chunks = chunk_text(text, chunk_size=200, overlap=40)
    if not chunks:
        return 0

    ids = [f"{doc_id}_chunk_{i}" for i in range(len(chunks))]
    metadatas = [{"source": doc_id, "chunk_index": i} for i in range(len(chunks))]
    
    collection.add(
        documents=chunks,
        metadatas=metadatas,
        ids=ids
    )
    return len(chunks)

def query_vector_db(query: str, n_results=10) -> list:
    """Queries Chroma DB collection and returns top matching text items."""
    results = collection.query(query_texts=[query], n_results=n_results)
    return results['documents'][0] if results['documents'] else []

def clear_vector_db():
    """Wipes out cached chunks from Chroma DB storage matrix."""
    existing = collection.get()
    if existing['ids']:
        collection.delete(ids=existing['ids'])