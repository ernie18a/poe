import json

with open('./data.json', 'r') as f:
    data = json.load(f)

print("Keys in root:", list(data.keys()))
if 'nodes' in data:
    nodes = data['nodes']
    print("Number of nodes:", len(nodes))
    # Print the first node
    first_key = list(nodes.keys())[0]
    print(f"Sample node [{first_key}]:", json.dumps(nodes[first_key], indent=2, ensure_ascii=False))

    # Print a keystone or notable if we can find one
    for k, v in nodes.items():
         if v.get('isKeystone') or 'Keystone' in str(v):
             print(f"Sample Keystone [{k}]:", json.dumps(v, indent=2, ensure_ascii=False))
             break
    for k, v in nodes.items():
         if v.get('isNotable') or 'Notable' in str(v):
             print(f"Sample Notable [{k}]:", json.dumps(v, indent=2, ensure_ascii=False))
             break
