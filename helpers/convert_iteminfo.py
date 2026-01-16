import json
import re

INPUT_FILE = "itemInfo_EN.lub"
OUTPUT_FILE = "osromr_items.json"

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
        
        # Try to match key = value
        kv = KEY_VALUE_RE.match(line)
        if kv:
            key, value = kv.groups()
            value = value.rstrip(',').strip()
            
            # Handle array values
            if value.startswith("{"):
                if "}" in value:
                    # Inline array: { "text" } or { "text", }
                    array_values = STRING_RE.findall(value)
                    item_data[key] = array_values
                else:
                    # Multi-line array
                    array_values, end_i = parse_multiline_array(lines, i + 1)
                    item_data[key] = array_values
                    i = end_i
            # Handle string values
            elif value.startswith('"'):
                item_data[key] = parse_lua_string(value)
            # Handle numeric values
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
        # Look for item start pattern
        item_match = ITEM_START_RE.search(lines[i])
        if not item_match:
            i += 1
            continue
        
        item_id = int(item_match.group(1))
        i += 1
        
        # Parse the entire item block
        item_data, end_i = parse_item_block(lines, i)
        i = end_i + 1
        
        # Only process items with identifiedDisplayName
        if "identifiedDisplayName" not in item_data:
            continue
        
        # Build the output structure
        current = {
            "id": item_id,
            "name": item_data.get("identifiedDisplayName"),
            "desc": ""
        }
        
        # Join description lines if present
        if "identifiedDescriptionName" in item_data:
            desc_lines = item_data["identifiedDescriptionName"]
            current["desc"] = "\n".join(desc_lines)
        
        # Add slot count only if > 0
        slot_count = item_data.get("slotCount", 0)
        if slot_count > 0:
            current["slot"] = slot_count
        
        items[str(item_id)] = current
    
    return items


def main():
    # Try different encodings
    for encoding in ['cp949', 'utf-8', 'latin-1']:
        try:
            with open(INPUT_FILE, "r", encoding=encoding) as f:
                text = f.read()
            print(f"Successfully read file with {encoding} encoding")
            break
        except (UnicodeDecodeError, FileNotFoundError) as e:
            if encoding == 'latin-1':  # Last attempt
                print(f"Error reading file: {e}")
                return
            continue
    
    items = convert_lub_to_json(text)
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
    
    print(f"\nConverted {len(items)} items → {OUTPUT_FILE}")
    
    # Show sample items to verify
    test_ids = ["501", "502", "3502", "42857"]
    print("\nSample items:")
    for id in test_ids:
        if id in items:
            name = items[id]['name']
            slot = items[id].get('slot', 0)
            slot_text = f" [{slot} slot(s)]" if slot > 0 else ""
            print(f"  {id}: {name}{slot_text}")
        else:
            print(f"  {id}: MISSING")


if __name__ == "__main__":
    main()