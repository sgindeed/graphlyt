import os
import json
from openai import OpenAI

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
FAST_LLM = os.environ.get("FAST_LLM", "llama-3.1-8b-instant")

client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=GROQ_API_KEY
)

def extract_graph_stream(file_name: str, text_content: str):
    """Processes content segments into architectural structural JSON tokens."""
    
    clean_text = text_content[500:6000] if len(text_content) > 500 else text_content
    
    prompt = f"""
    Analyze the text and extract a high-density knowledge graph.
    You must extract BOTH entities (nodes) and their relationships (edges).
    
    CRITICAL STREAMING RULE: 
    1. First, output exactly 15 to 25 highly relevant <node> tags.
    2. Then, output exactly 15 to 25 <edge> tags connecting them. 
    DO NOT output more nodes than you have room to connect.
    
    Format strictly using XML tags. Do not add markdown or conversational text.
    
    <node>{{"id": "node1", "name": "Name", "type": "Person"}}</node>
    ... [ALL NODES FIRST] ...
    <edge>{{"source": "node1", "target": "node2", "relation": "KNOWS"}}</edge>
    ... [ALL EDGES SECOND] ...
    
    Text Source Stream ({file_name}):
    {clean_text} 
    """
    
    try:
        response = client.chat.completions.create(
            model=FAST_LLM,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            stream=True
        )
        
        buffer = ""
        for chunk in response:
            if chunk.choices and len(chunk.choices) > 0:
                delta = chunk.choices[0].delta
                if hasattr(delta, 'content') and delta.content:
                    buffer += delta.content
                    
                    while "</node>" in buffer or "</edge>" in buffer:
                        if "</node>" in buffer:
                            start = buffer.find("<node>")
                            end = buffer.find("</node>") + 7
                            if start != -1:
                                tag_content = buffer[start:end]
                                buffer = buffer[end:]
                                json_str = tag_content.replace("<node>", "").replace("</node>", "")
                                try:
                                    yield {"type": "node", "data": json.loads(json_str)}
                                except json.JSONDecodeError:
                                    pass
                            else:
                                buffer = buffer.replace("</node>", "", 1)
                                
                        elif "</edge>" in buffer:
                            start = buffer.find("<edge>")
                            end = buffer.find("</edge>") + 7
                            if start != -1:
                                tag_content = buffer[start:end]
                                buffer = buffer[end:]
                                json_str = tag_content.replace("<edge>", "").replace("</edge>", "")
                                try:
                                    yield {"type": "edge", "data": json.loads(json_str)}
                                except json.JSONDecodeError:
                                    pass
                            else:
                                buffer = buffer.replace("</edge>", "", 1)
                                
    except Exception as e:
        yield {"type": "error", "message": str(e)}