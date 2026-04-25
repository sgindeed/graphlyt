import os
import json
from dotenv import load_dotenv
from openai import OpenAI 

load_dotenv(override=True)

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("Missing GROQ_API_KEY in .env file.")

client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=GROQ_API_KEY
)

class WikiManager:
    def __init__(self, storage_path="./wiki_data"):
        self.storage_path = storage_path
        os.makedirs(self.storage_path, exist_ok=True)

    def add_document(self, title: str, content: str):
        safe_title = "".join(c for c in title if c.isalnum() or c in "._- ").strip() or "unnamed_doc"
        with open(os.path.join(self.storage_path, f"{safe_title}.md"), "w", encoding="utf-8") as f:
            f.write(f"# {title}\n\n{content}")

    def search(self, query: str) -> str:
        # (Unchanged search logic)
        query_words = set(query.lower().split())
        results = []
        for filename in os.listdir(self.storage_path):
            if filename.endswith(".md"):
                with open(os.path.join(self.storage_path, filename), "r", encoding="utf-8") as f:
                    content = f.read()
                score = sum(1 for word in query_words if word in content.lower())
                if score > 0:
                    results.append((score, content))
        if not results:
            return "No relevant context found."
        results.sort(key=lambda x: x[0], reverse=True)
        return "\n\n---\n\n".join([res[1][:1500] for res in results[:2]])

wiki_manager = WikiManager()

def extract_graph_stream(file_name: str, text_content: str):
    wiki_manager.add_document(title=file_name, content=text_content)
    
    prompt = f"""
    Analyze the text and extract a knowledge graph.
    You MUST output each entity and relationship one by one using exact XML tags. 
    Do not output markdown blocks. Do not add conversational text.
    
    Format required:
    <node>{{"id": "node1", "name": "Name", "type": "Person"}}</node>
    <edge>{{"source": "node1", "target": "node2", "relation": "KNOWS"}}</edge>
    
    Text:
    {text_content[:2000]} 
    """
    
    print("\n--- INITIATING REAL-TIME NEURAL STREAM ---")
    
    try:
        response = client.chat_completion(
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1500,
            stream=True
        )
        
        buffer = ""
        for chunk in response:
            # FIX: Added safety check to prevent 'list index out of range' on final chunk
            if chunk.choices and len(chunk.choices) > 0:
                delta = chunk.choices[0].delta
                if hasattr(delta, 'content') and delta.content:
                    content = delta.content
                    buffer += content
                    print(content, end="", flush=True)
                    
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
        print(f"\nStream Error: {e}")
        yield {"type": "error", "message": str(e)}


def query_rag_pipeline(user_query: str):
    try:
        context = wiki_manager.search(user_query)
        prompt = f"Context: {context}\nQuery: {user_query}\nAnswer:"
        response = client.chat_completion(
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return "System Error: Neural processing interrupted."
