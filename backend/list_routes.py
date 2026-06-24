import requests
r = requests.get('http://127.0.0.1:8000/openapi.json')
paths = list(r.json().get('paths', {}).keys())
for p in sorted(paths):
    print(p)
print(f"\nTotal routes: {len(paths)}")
