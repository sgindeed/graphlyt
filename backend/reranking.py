import os
import json
import re
from openai import OpenAI

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
RERANK_LLM = os.environ.get("RERANK_LLM", "llama-3.3-70b-versatile")

client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=GROQ_API_KEY
)

def rerank_chunks_with_llm(query: str, chunks: list, top_k: int = 5) -> list:
    """Uses an LLM to select and order the chunks that best answer the query.

    Returns a list of {"text", "original_rank"} dicts (best first) instead of
    bare strings, so the frontend can show provenance for the reranking stage
    separately from the raw vector-search stage.
    """
    if not chunks:
        return []

    system_prompt = (
        "You are an expert retrieval evaluator. Given a user query and a numbered "
        "list of text chunks, choose the chunks that best answer the query, ordered "
        "from most to least relevant. "
        f'Respond ONLY with a JSON object of the exact form {{"indices": [i1, i2, ...]}} '
        f"containing up to {top_k} 0-based indices, most relevant first. "
        "Do not add explanation or any other keys."
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
            # NOTE: json_object mode requires the model to return a JSON
            # *object*, not a bare array - the system prompt above must match
            # that shape ({"indices": [...]}) or the model will fight the
            # constraint and reranking silently degrades.
            response_format={"type": "json_object"}
        )

        result_str = response.choices[0].message.content
        try:
            indices = json.loads(result_str).get("indices", [])
        except (json.JSONDecodeError, AttributeError):
            indices = [int(x) for x in re.findall(r'\d+', result_str)]

        seen = set()
        ordered_valid = []
        for i in indices:
            if isinstance(i, int) and 0 <= i < len(chunks) and i not in seen:
                seen.add(i)
                ordered_valid.append(i)

        if not ordered_valid:
            ordered_valid = list(range(min(top_k, len(chunks))))

        return [{"text": chunks[i], "original_rank": i} for i in ordered_valid[:top_k]]

    except Exception as e:
        print(f"Reranking framework error: {e}")
        fallback_k = min(top_k, len(chunks))
        return [{"text": chunks[i], "original_rank": i} for i in range(fallback_k)]