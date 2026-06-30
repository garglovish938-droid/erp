import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

filepath = r"d:\Factory erp\erp_demo\src\components\Inventory.tsx"
results = []

with open(filepath, "r", encoding="utf-8") as f:
    for i, line in enumerate(f, 1):
        if "cost" in line.lower() or "price" in line.lower() or "toLocaleString" in line or "$" in line or "USD" in line:
            results.append((i, line.strip()))

print(f"Found {len(results)} matches in Inventory.tsx:")
for line_num, content in results[:100]:
    print(f"{line_num} -> {content}")
