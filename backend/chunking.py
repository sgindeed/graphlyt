def chunk_text(text: str, chunk_size=350, overlap=50) -> list:
    """Splits text into sliding-window word chunks for vectorization."""
    if not text or not text.strip():
        return []

    words = text.split()
    chunks = []
    
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i:i + chunk_size])
        if chunk.strip():
            chunks.append(chunk)

    return chunks
