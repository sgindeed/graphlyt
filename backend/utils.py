import re
import hashlib


def _normalize(text: str) -> str:
    """Normalizes whitespace/case so near-identical text hashes the same."""
    return re.sub(r'\s+', ' ', text).strip().lower()


def deduplicate_text(text: str, min_len: int = 30) -> str:
    """
    Strips duplicate paragraphs/sentences out of extracted document text.

    PyPDF2 (and PDF extractors generally) frequently re-emit repeated
    boilerplate, headers/footers, or entire duplicated blocks when a PDF has
    overlapping text layers, repeating layout elements, or multi-column
    content extracted out of order. Left unchecked this:
      1. Pollutes the vector index with near-duplicate chunks that crowd out
         genuinely distinct context during retrieval (this is the root cause
         of thin/repetitive RAG answers).
      2. Wastes the graph-extraction LLM's context budget re-extracting the
         same entities/relations instead of covering the whole document.

    First occurrence of each paragraph/sentence is kept, original order is
    preserved, and anything under `min_len` chars is left alone (too short
    to safely dedupe - e.g. numbers, short headers).
    """
    if not text:
        return text

    paragraphs = re.split(r'\n\s*\n|\n', text)
    seen_hashes = set()
    kept_paragraphs = []

    for paragraph in paragraphs:
        sentences = re.split(r'(?<=[.!?])\s+', paragraph)
        kept_sentences = []
        for sentence in sentences:
            clean = sentence.strip()
            if not clean:
                continue
            norm = _normalize(clean)
            if len(norm) < min_len:
                kept_sentences.append(clean)
                continue
            h = hashlib.md5(norm.encode()).hexdigest()
            if h in seen_hashes:
                continue
            seen_hashes.add(h)
            kept_sentences.append(clean)
        if kept_sentences:
            kept_paragraphs.append(' '.join(kept_sentences))

    return '\n'.join(kept_paragraphs)


def dedupe_chunks(chunks: list) -> list:
    """Drops exact/near-duplicate chunks, keeping the first occurrence."""
    seen = set()
    unique = []
    for chunk in chunks:
        norm = _normalize(chunk)
        h = hashlib.md5(norm.encode()).hexdigest()
        if h in seen:
            continue
        seen.add(h)
        unique.append(chunk)
    return unique