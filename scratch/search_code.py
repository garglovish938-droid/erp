import os
import sys

def search_in_file(filepath, query):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()
    matches = []
    for idx, line in enumerate(lines):
        if query.lower() in line.lower():
            matches.append((idx + 1, line.strip()))
    return matches

def main():
    if len(sys.argv) < 3:
        print("Usage: python search_code.py <filepath> <query>")
        return
    filepath = sys.argv[1]
    query = sys.argv[2]
    print(f"Searching for '{query}' in {filepath}:")
    matches = search_in_file(filepath, query)
    if matches:
        for num, content in matches[:40]:
            print(f"  Line {num}: {content}")
    else:
        print("  No matches found.")

if __name__ == "__main__":
    main()
