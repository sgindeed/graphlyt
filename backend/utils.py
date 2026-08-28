import re
import xml.etree.ElementTree as ET
from typing import Any, Dict, List
import numpy as np

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))

def clean_xml_string(raw_content: str) -> str:
    """Extracts XML block if enclosed in markdown code fences or tags."""
    match = re.search(r"```(?:xml)?\s*(<graph>.*?</graph>)\s*```", raw_content, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    match = re.search(r"(<graph>.*?</graph>)", raw_content, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return raw_content.strip()

def parse_graph_xml(xml_content: str) -> Dict[str, List[Dict[str, Any]]]:
    """Parses graph nodes and edges from structured XML."""
    cleaned = clean_xml_string(xml_content)
    nodes, edges = [], []

    try:
        root = ET.fromstring(cleaned)
        nodes_tag = root.find("nodes")
        if nodes_tag is not None:
            for n in nodes_tag.findall("node"):
                node_id = n.get("id") or n.findtext("id")
                node_name = n.get("name") or n.findtext("name") or node_id
                node_type = n.get("type") or n.findtext("type") or "Concept"
                if node_id:
                    nodes.append({
                        "id": node_id.strip(),
                        "name": node_name.strip() if node_name else node_id.strip(),
                        "type": node_type.strip()
                    })

        edges_tag = root.find("edges")
        if edges_tag is not None:
            for e in edges_tag.findall("edge"):
                source = e.get("source") or e.findtext("source")
                target = e.get("target") or e.findtext("target")
                label = e.get("label") or e.findtext("label") or "RELATES_TO"
                if source and target:
                    edges.append({
                        "source": source.strip(),
                        "target": target.strip(),
                        "label": label.strip()
                    })

    except ET.ParseError:
        for n_match in re.finditer(r'<node\s+id=["\'](.*?)["\']\s+name=["\'](.*?)["\']\s+type=["\'](.*?)["\']\s*/>', cleaned):
            nodes.append({
                "id": n_match.group(1).strip(),
                "name": n_match.group(2).strip(),
                "type": n_match.group(3).strip()
            })
        for e_match in re.finditer(r'<edge\s+source=["\'](.*?)["\']\s+target=["\'](.*?)["\']\s*(?:label=["\'](.*?)["\'])?\s*/>', cleaned):
            edges.append({
                "source": e_match.group(1).strip(),
                "target": e_match.group(2).strip(),
                "label": (e_match.group(3) or "RELATES_TO").strip()
            })

    return {"nodes": nodes, "edges": edges}
