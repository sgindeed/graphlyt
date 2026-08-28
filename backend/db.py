from typing import Any, Dict

# Memory-based active graph state
active_graph: Dict[str, Any] = {"nodes": [], "links": []}

def clear_graph():
    """Wipes the existing graph state."""
    global active_graph
    active_graph = {"nodes": [], "links": []}

def set_graph_data(nodes: list, edges: list):
    """Saves extracted nodes and edges directly into state."""
    global active_graph
    active_graph["nodes"] = nodes
    active_graph["links"] = edges

def get_graph_data():
    """Formats the graph data for the frontend."""
    return active_graph
