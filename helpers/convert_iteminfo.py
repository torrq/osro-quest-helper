import json
import re

INPUT_FILE = "itemInfo_EN.lub"
OUTPUT_FILE = "items.json"

ITEM_START_RE = re.compile(r"\[(\d+)\]\s*=\s*{")
KEY_VALUE_RE = re.compile(r"(\w+)\s*=\s*(.+?)(?:,)?$")
STRING_RE = re.compile(r'"(.*?)"')


def parse_lua_string(value):
    m = STRING_RE.search(value)
    return m.group(1) if m else None


def parse_inline_array(value):
    """Parse an array that's entirely on one line like { "..." }"""
    strings = STRING_RE.findall(value)
    return strings


def parse_multiline_array(lines, start_index):
    """Parse a Lua array that spans multiple lines"""
    values = []
    i = start_index

    while i < len(lines):
        line = lines[i].strip()

        # Check if we've reached the end of the array
        if line.startswith("}"):
            return values, i

        # Extract string values from the line
        m = STRING_RE.search(line)
        if m:
            values.append(m.group(1))

        i += 1

    return values, i


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
        i += 1

        current = {
            "id": item_id,
            "name": None,
            "desc": ""
        }
        slot_count = 0

        # Parse the item's properties
        while i < len(lines):
            line = lines[i].strip()

            # End of this item definition
            if line.startswith("}"):
                break

            kv = KEY_VALUE_RE.match(line)
            if kv:
                key, value = kv.groups()

                if key == "identifiedDisplayName":
                    current["name"] = parse_lua_string(value)

                elif key == "identifiedDescriptionName":
                    # Check if the array is complete on this line (like { "..." })
                    if "{" in value and "}" in value:
                        # Inline array - parse it from the current line
                        desc_lines = parse_inline_array(value)
                        current["desc"] = "\n".join(desc_lines)
                    elif "{" in value:
                        # Multiline array - parse from next lines
                        desc_lines, end_i = parse_multiline_array(lines, i + 1)
                        current["desc"] = "\n".join(desc_lines)
                        i = end_i  # Position at the closing }
                    else:
                        # Simple string value
                        current["desc"] = parse_lua_string(value) or ""

                elif key == "slotCount":
                    try:
                        slot_count = int(value.rstrip(","))
                    except ValueError:
                        slot_count = 0

            i += 1

        # Only add items that have a name
        if current["name"]:
            # Only add slot field if it's greater than 0
            if slot_count > 0:
                current["slot"] = slot_count
            
            items[str(item_id)] = current

        # Move past the closing } of the item
        i += 1

    return items


def main():
    try:
        with open(INPUT_FILE, "r", encoding="cp949") as f:
            text = f.read()
    except UnicodeDecodeError:
        # Try UTF-8 if cp949 fails
        print("cp949 encoding failed, trying UTF-8...")
        with open(INPUT_FILE, "r", encoding="utf-8") as f:
            text = f.read()

    items = convert_lub_to_json(text)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)

    print(f"Converted {len(items)} items → {OUTPUT_FILE}")
    
    # Show some sample IDs to verify
    test_ids = ["13576", "13585", "13586", "13593"]
    print("\nSample items:")
    for id in test_ids:
        if id in items:
            print(f"  {id}: {items[id]['name']}")
        else:
            print(f"  {id}: MISSING")


if __name__ == "__main__":
    main()