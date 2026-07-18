import os
import re
from openai import OpenAI

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
RERANK_LLM = os.environ.get("RERANK_LLM", "llama-3.3-70b-versatile")

client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=GROQ_API_KEY
)

def rerank_chunks_with_llm(query: str, chunks: list) -> list:
    """Uses deep-reasoning models to score context accuracy relative to query."""
    if not chunks:
        return []
        
    system_prompt = (
        "You are an expert retrieval evaluator. Given a user query and a list of text chunks, "
        "identify which chunks contain the answer. "
        "Output a JSON array of the indices (0-based) of the top 3 most relevant chunks. "
        "Output ONLY valid JSON, e.g., [0, 2]. Do not add explanation."
    )
    
    chunks_text = "\n\n".join([f"[{i}] {chunk}" for i, chunk in enumerate(chunks)])
    user_prompt = f"Query: {query}\n\nChunks:\n{chunks_text}"

    try:
        response = client.chat.completions.create(
            model=RERANK_LLM,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0,
            response_format={"type": "json_object"}
        )
        
        result_str = response.choices[0].message.content
        indices = [int(x) for x in re.findall(r'\d+', result_str)]
        valid_indices = list(set([i for i in indices if 0 <= i < len(chunks)]))
        return [chunks[i] for i in valid_indices[:3]] if valid_indices else [chunks[0]]
    except Exception as e:
        print(f"Reranking framework error: {e}")
        return chunks[:2]