#!/usr/bin/env python3
"""
generate_search_index.py

Generate search indices from osromr_items.json for fast client-side searching.
Creates two indices: name-only and description-only.
"""

import json
from pathlib import Path
from collections import defaultdict
import re

# Paths
SCRIPT_DIR = Path(__file__).parent
ITEMS_FILE = SCRIPT_DIR / ".." / "data" / "osromr_items.json"
OUTPUT_NAME = SCRIPT_DIR / ".." / "data" / "osromr_search_index_name.json"
OUTPUT_DESC = SCRIPT_DIR / ".." / "data" / "osromr_search_index_desc.json"

def tokenize(text):
    """Convert text to searchable tokens (lowercase words)"""
    if not text:
        return []
    return re.findall(r'\w+', text.lower())

def build_name_index(items):
    """Build index from item names only"""
    index = defaultdict(set)
    
    for item_id, item_data in items.items():
        item_id_int = int(item_id)
        name = item_data.get("name", "")
        for token in tokenize(name):
            index[token].add(item_id_int)
    
    return {term: sorted(list(ids)) for term, ids in index.items()}

def build_desc_index(items):
    """Build index from item descriptions only"""
    index = defaultdict(set)
    
    for item_id, item_data in items.items():
        item_id_int = int(item_id)
        desc = item_data.get("desc", "")
        for token in tokenize(desc):
            index[token].add(item_id_int)
    
    return {term: sorted(list(ids)) for term, ids in index.items()}

def main():
    print("\nGenerating search indices...")
    
    if not ITEMS_FILE.exists():
        print(f"Error: Items file not found: {ITEMS_FILE}")
        return
    
    with open(ITEMS_FILE, "r", encoding="utf-8") as f:
        items = json.load(f)
    
    print(f"Loaded {len(items)} items")
    
    # Build indices
    name_index = build_name_index(items)
    desc_index = build_desc_index(items)
    
    # Write
    OUTPUT_NAME.parent.mkdir(parents=True, exist_ok=True)
    
    with open(OUTPUT_NAME, "w", encoding="utf-8") as f:
        json.dump(name_index, f, separators=(',', ':'))
    
    with open(OUTPUT_DESC, "w", encoding="utf-8") as f:
        json.dump(desc_index, f, separators=(',', ':'))
    
    print(f"✓ {OUTPUT_NAME.name}: {len(name_index)} terms")
    print(f"✓ {OUTPUT_DESC.name}: {len(desc_index)} terms\n")

if __name__ == "__main__":
    main()