from utils import dedupe_chunks


def chunk_text(text: str, chunk_size=800, overlap=100):
    """Splits text into sliding-window word chunks for vectorization.

    De-duplicates the resulting chunks as a defense-in-depth safeguard: even
    after upstream text-level deduplication, templated/boilerplate content
    can still produce near-identical chunks, which would otherwise crowd out
    genuinely distinct context during vector retrieval.
    """
    if not text or not text.strip():
        return []

    words = text.split()
    if not words:
        return []

    step = max(chunk_size - overlap, 1)  # guard against overlap >= chunk_size
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i:i + chunk_size])
        if chunk.strip():
            chunks.append(chunk)
        i += step

    return dedupe_chunks(chunks)