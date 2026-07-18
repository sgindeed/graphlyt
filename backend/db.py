import networkx as nx
import json
import os
from dotenv import load_dotenv

load_dotenv()

# We will persist the NetworkX graph to a local JSON file
GRAPH_FILE = "knowledge_graph.json"

# Initialize a global directed graph
G = nx.DiGraph()

def init_graph():
    """Initializes the NetworkX graph, loading from disk if available."""
    global G
    if os.path.exists(GRAPH_FILE):
        try:
            with open(GRAPH_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                # Load graph from node-link format
                G = nx.node_link_graph(data)
            print("Neural Graph initialized from disk (NetworkX).")
        except Exception as e:
            print(f"Error loading graph from disk: {e}")
            G = nx.DiGraph()
    else:
        G = nx.DiGraph()
        print("Initialized fresh Neural Graph (NetworkX).")

def _save_to_disk():
    """Helper function to persist the graph state to a JSON file."""
    try:
        data = nx.node_link_data(G)
        with open(GRAPH_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4)
    except Exception as e:
        print(f"Failed to persist graph to disk: {e}")

def clear_graph():
    """Wipes the existing graph to ensure only the current document is visualized."""
    global G
    G.clear()
    _save_to_disk()
    print("Graph cleared for fresh ingestion.")

def save_graph_data(nodes, edges):
    """Saves extracted nodes and edges directly into the NetworkX graph."""
    global G
    
    for node in nodes:
        node_id = str(node.get('id', ''))
        # Add node, unpack the rest of the dictionary as node attributes
        G.add_node(node_id, **node)
        
    for edge in edges:
        source_id = str(edge.get('source', ''))
        target_id = str(edge.get('target', ''))
        relation = str(edge.get('relation', 'CONNECTED_TO')).replace(' ', '_').upper()
        
        # Add edge, storing the relation as 'label'
        G.add_edge(source_id, target_id, label=relation, **edge)
        
    # Persist changes
    _save_to_disk()

def get_graph_data():
    """Formats the NetworkX graph data for the frontend."""
    global G
    nodes = []
    edges = []
    
    for node_id, data in G.nodes(data=True):
        node_payload = data.copy()
        if 'id' not in node_payload:
            node_payload['id'] = node_id
        if 'type' not in node_payload:
            node_payload['type'] = 'Entity'
        nodes.append(node_payload)
        
    for u, v, data in G.edges(data=True):
        edges.append({
            "source": u,
            "target": v,
            "label": data.get('label', 'CONNECTED_TO')
        })
        
    return {"nodes": nodes, "edges": edges}