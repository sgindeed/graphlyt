import psycopg2
from psycopg2.errors import UniqueViolation, InvalidSchemaName
import json
import os
from dotenv import load_dotenv

load_dotenv()

DB_PARAMS = {
    "dbname": "knowledge_graph_db",
    "user": "postgres",
    "password": os.getenv("DB_PASSWORD"), 
    "host": "localhost",
    "port": "5432"
}

def get_db_connection():
    conn = psycopg2.connect(**DB_PARAMS)
    conn.autocommit = True
    return conn

def init_age():
    """Initializes Apache AGE and safely handles graph creation."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("LOAD 'age';")
            cur.execute("SET search_path = ag_catalog, \"$user\", public;")
            try:
                cur.execute("SELECT create_graph('doc_graph');")
                print("Neural Graph 'doc_graph' initialized.")
            except (UniqueViolation, InvalidSchemaName, Exception) as e:
                # AGE often throws InvalidSchemaName if the graph exists
                print("Neural Graph already exists, skipping initialization.")
                conn.rollback() 
    finally:
        conn.close()

def clear_graph():
    """Wipes the existing graph to ensure only the current document is visualized."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("LOAD 'age';")
            cur.execute("SET search_path = ag_catalog, \"$user\", public;")
            cur.execute("SELECT * FROM cypher('doc_graph', $$ MATCH (n) DETACH DELETE n $$) as (v agtype);")
            print("Graph cleared for fresh ingestion.")
    except Exception as e:
        print(f"Clear error: {e}")
    finally:
        conn.close()

def save_graph_to_age(nodes, edges):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("LOAD 'age';")
            cur.execute("SET search_path = ag_catalog, \"$user\", public;")
            
            for node in nodes:
                node_type = node.get('type', 'Entity').replace(' ', '_')
                node_id = str(node.get('id', '')).replace("'", "''")
                node_name = str(node.get('name', '')).replace("'", "''")
                query = f"SELECT * FROM cypher('doc_graph', $$ MERGE (n:{node_type} {{id: '{node_id}', name: '{node_name}'}}) $$) as (v agtype);"
                cur.execute(query)
                
            for edge in edges:
                source_id = str(edge.get('source', '')).replace("'", "''")
                target_id = str(edge.get('target', '')).replace("'", "''")
                relation = str(edge.get('relation', 'CONNECTED_TO')).replace(' ', '_').upper()
                query = f"SELECT * FROM cypher('doc_graph', $$ MATCH (a), (b) WHERE a.id = '{source_id}' AND b.id = '{target_id}' MERGE (a)-[r:{relation}]->(b) $$) as (v agtype);"
                cur.execute(query)
    finally:
        conn.close()

def get_graph_data():
    conn = get_db_connection()
    nodes, edges = [], []
    try:
        with conn.cursor() as cur:
            cur.execute("LOAD 'age';")
            cur.execute("SET search_path = ag_catalog, \"$user\", public;")
            cur.execute("SELECT * FROM cypher('doc_graph', $$ MATCH (n) RETURN properties(n), labels(n) $$) as (p agtype, l agtype);")
            for row in cur.fetchall():
                node = json.loads(str(row[0]).replace("'", '"'))
                node['type'] = row[1][0] if row[1] else 'Entity'
                nodes.append(node)
            cur.execute("SELECT * FROM cypher('doc_graph', $$ MATCH (a)-[r]->(b) RETURN a.id, b.id, type(r) $$) as (s agtype, t agtype, r agtype);")
            for row in cur.fetchall():
                edges.append({"source": str(row[0]).strip('"'), "target": str(row[1]).strip('"'), "label": str(row[2]).strip('"')})
    finally:
        conn.close()
    return {"nodes": nodes, "edges": edges}