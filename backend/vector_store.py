import os
from groq import AsyncGroq
from utils import parse_graph_xml

# Automatically pulls from Render's Environment Variables
groq_client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))

# Migrated to Groq's active 120B model
FAST_LLM = "openai/gpt-oss-120b"

async def extract_graph_xml(all_text: str):
    prompt = f"""Extract a structured knowledge graph from the text below.
Format the output strictly as XML conforming to this template:
<graph>
  <nodes>
    <node id="UniqueEntityID" name="Entity Name" type="Person|Organization|Location|Concept|Event|Technology"/>
  </nodes>
  <edges>
    <edge source="UniqueEntityID" target="UniqueEntityID" label="RELATION_NAME"/>
  </edges>
</graph>

Text:
{all_text}
"""

    response = await groq_client.chat.completions.create(
        model=FAST_LLM,
        messages=[
            {"role": "system", "content": "You are a graph extraction engine that outputs strictly in XML format. Do not wrap the response in markdown blocks."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.1
    )

    xml_output = response.choices[0].message.content or ""
    return parse_graph_xml(xml_output)
