import os
from openai import AsyncOpenAI
from utils import parse_graph_xml

openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", "your-openai-api-key"))

async def extract_graph_xml(all_text: str):
    """Calls OpenAI to generate the XML knowledge graph and parses it."""
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

    response = await openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You are a graph extraction engine that outputs strictly in XML format."},
            {"role": "user", "content": prompt}
        ]
    )

    xml_output = response.choices[0].message.content or ""
    return parse_graph_xml(xml_output)
