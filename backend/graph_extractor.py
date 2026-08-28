import json
import time
import os
import re
from groq import Groq
from langchain_text_splitters import RecursiveCharacterTextSplitter

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
FAST_LLM = os.environ.get("FAST_LLM", "openai/gpt-oss-20b")
client = Groq(api_key=GROQ_API_KEY)

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=100
)

def normalize_id(text):
    """Generalised ID generator to ensure nodes with same names merge."""
    return re.sub(r'[^a-z0-9]', '_', str(text).lower().strip())

def extract_graph_stream(file_name, text_content):
    """
    Processes the document as one unified stream with strict deduplication.
    """
    chunks = text_splitter.split_text(text_content)
    
    seen_nodes = set()
    seen_edges = set()
    
    # The system prompt explicitly bans Markdown and enforces strict JSON keys
    prompt_base = """
    You are an expert data extraction algorithm. Analyze the provided text and extract entities and relationships.
    You MUST output ONLY a valid JSON object. Do NOT wrap the response in Markdown code blocks (e.g., ```json). Do NOT add explanations.
    Your output must strictly match this exact JSON schema:
    {
      "nodes": [
        {"id": "unique_id_1", "name": "Human Readable Name", "type": "Category"}
      ],
      "edges": [
        {"source": "unique_id_1", "target": "unique_id_2", "relation": "Description"}
      ]
    }
    """

    for i, chunk in enumerate(chunks):
        # Defense in depth: Skip empty or tiny chunks that cause JSON generation failures
        if len(chunk.strip()) < 15:
            continue
            
        try:
            if i > 0: time.sleep(2.5) 

            response = client.chat.completions.create(
                model=FAST_LLM,
                messages=[
                    {"role": "system", "content": prompt_base},
                    {"role": "user", "content": f"Extract graph data from the following text:\n\n{chunk}"}
                ],
                response_format={"type": "json_object"},
                temperature=0.1
            )
            
            data = json.loads(response.choices[0].message.content)
            
            # 1. Process Nodes with Normalization/Deduplication
            for node in data.get("nodes", []):
                # Use name to create a normalized ID
                node_id = normalize_id(node.get("name", node.get("id")))
                if node_id not in seen_nodes:
                    seen_nodes.add(node_id)
                    # Update node ID to be consistent
                    node["id"] = node_id
                    yield {"type": "node", "data": node}
                
            # 2. Process Edges with Deduplication
            for edge in data.get("edges", []):
                # Normalize source/target IDs to match the node ID generation
                s_id = normalize_id(edge.get("source"))
                t_id = normalize_id(edge.get("target"))
                edge_key = f"{s_id}_{t_id}_{edge.get('relation')}"
                
                if edge_key not in seen_edges:
                    seen_edges.add(edge_key)
                    edge["source"] = s_id
                    edge["target"] = t_id
                    yield {"type": "edge", "data": edge}
                
        except Exception as e:
            print(f"Error processing chunk {i}: {e}")
            yield {"type": "error", "message": str(e)}
