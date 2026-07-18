def chunk_text(text: str, chunk_size=200, overlap=20):
    """Splits text into sliding-window tokens/words chunks for vectorization."""
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i:i + chunk_size])
        chunks.append(chunk)
        i += (chunk_size - overlap)
    return chunks