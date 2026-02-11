#!/usr/bin/env python3
"""
convert_iteminfo-mrhr.py

Convert an OSRO MR/HR itemInfo Lub file -> JSON (structure-aware, cp949-friendly).
Generates a separate list of new item IDs.
"""

import re
import json
import random
from pathlib import Path

# Paths
SCRIPT_DIR = Path(__file__).parent
EXISTING_ITEMS_FILE = SCRIPT_DIR / ".." / "data" / "osromr_items.json"
INPUT_FILE = "itemInfo_EN.lub"
OUTPUT_FILE = "osromr_items.json"
OUTPUT_NEW_FILE = SCRIPT_DIR / ".." / "data" / "osromr_items_new.json"

ITEM_START_RE = re.compile(r"\[(\d+)\]\s*=\s*{")
KEY_VALUE_RE = re.compile(r"^(\w+)\s*=\s*(.+?)(?:,\s*)?$")
STRING_RE = re.compile(r'"((?:[^"\\]|\\.)*)"')

def parse_lua_string(value):
    """Extract a single string value"""
    m = STRING_RE.search(value)
    return m.group(1) if m else None

def parse_multiline_array(lines, start_index):
    """Parse array that may span multiple lines"""
    values = []
    i = start_index

    while i < len(lines):
        line = lines[i].strip()

        # End of array
        if line.startswith("}"):
            return values, i

        # Extract all quoted strings from this line
        matches = STRING_RE.findall(line)
        values.extend(matches)

        i += 1

    return values, i

def parse_item_block(lines, start_index):
    """Parse a complete item block and return all its properties"""
    item_data = {}
    i = start_index

    while i < len(lines):
        line = lines[i].strip()

        # End of item block
        if line == "}," or line == "}":
            break

        kv = KEY_VALUE_RE.match(line)
        if kv:
            key, value = kv.groups()
            value = value.rstrip(',').strip()

            if value.startswith("{"):
                if "}" in value:
                    item_data[key] = STRING_RE.findall(value)
                else:
                    array_values, end_i = parse_multiline_array(lines, i + 1)
                    item_data[key] = array_values
                    i = end_i
            elif value.startswith('"'):
                item_data[key] = parse_lua_string(value)
            else:
                try:
                    item_data[key] = int(value)
                except ValueError:
                    item_data[key] = value

        i += 1

    return item_data, i

def convert_lub_to_json(text):
    lines = text.splitlines()
    items = {}
    i = 0

    while i < len(lines):
        item_match = ITEM_START_RE.search(lines[i])
        if not item_match:
            i += 1
            continue

        item_id = int(item_match.group(1))
        str_id = str(item_id)
        i += 1

        item_data, end_i = parse_item_block(lines, i)
        i = end_i + 1

        if "identifiedDisplayName" not in item_data:
            continue

        current = {
            "name": item_data.get("identifiedDisplayName"),
            "desc": ""
        }

        if "identifiedDescriptionName" in item_data:
            current["desc"] = "\n".join(item_data["identifiedDescriptionName"])

        slot_count = item_data.get("slotCount", 0)
        if slot_count > 0:
            current["slot"] = slot_count

        items[str_id] = current

    return items

def main():
    # Load existing IDs
    existing_ids = set()
    if EXISTING_ITEMS_FILE.exists():
        try:
            with open(EXISTING_ITEMS_FILE, "r", encoding="utf-8") as f:
                old_data = json.load(f)
                existing_ids = set(old_data.keys())
            print(f"Loaded {len(existing_ids)} existing items")
        except Exception as e:
            print(f"Warning: Could not read existing items: {e}")

    # Read input
    for encoding in ["cp949", "utf-8", "latin-1"]:
        try:
            with open(INPUT_FILE, "r", encoding=encoding) as f:
                text = f.read()
            print(f"Read \"{INPUT_FILE}\" with {encoding}")
            break
        except (UnicodeDecodeError, FileNotFoundError) as e:
            if encoding == "latin-1":
                print(f"Error: {e}")
                return

    # Convert
    items = convert_lub_to_json(text)
    items = dict(sorted(items.items(), key=lambda kv: int(kv[0])))

    # Find new IDs
    new_ids = sorted([int(id) for id in items.keys() if id not in existing_ids])

    # Write items
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)

    # Write new IDs
    OUTPUT_NEW_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_NEW_FILE, "w", encoding="utf-8") as f:
        json.dump(new_ids, f, separators=(',', ':'))

    print(f"✓ {len(items)} items → {OUTPUT_FILE}")
    print(f"✓ {len(new_ids)} new items → {OUTPUT_NEW_FILE}")

    # Sample
    print("\nSamples:")
    sample_ids = random.sample(sorted(int(i) for i in items.keys()), min(10, len(items)))
    for item_id in sorted(sample_ids):
        item = items[str(item_id)]
        new_mark = " [NEW]" if item_id in new_ids else ""
        print(f"  {item_id}: {item['name']}{new_mark}")

if __name__ == "__main__":
    main()