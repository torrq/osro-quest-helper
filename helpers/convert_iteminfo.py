import json
import re
import random

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

        items[str(item_id)] = current

    return items

def main():
    for encoding in ["cp949", "utf-8", "latin-1"]:
        try:
            with open(INPUT_FILE, "r", encoding=encoding) as f:
                text = f.read()
            print(f"\nSuccessfully read \"{INPUT_FILE}\" with {encoding} encoding")
            break
        except (UnicodeDecodeError, FileNotFoundError) as e:
            if encoding == "latin-1":
                print(f"\nError reading file: {e}")
                return

    items = convert_lub_to_json(text)

    # ensure items.json is sorted by numeric ID
    items = dict(sorted(items.items(), key=lambda kv: int(kv[0])))

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)

    print(f"Converted {len(items)} items → {OUTPUT_FILE}")

    # -------- Balanced random sample output --------
    print("\nRandom samples:\n")

    ids = sorted(int(i) for i in items.keys())
    count = min(10, len(ids))

    if count == 0:
        print("  (no items parsed)")
        return

    if len(ids) <= count:
        sample_ids = ids
    else:
        buckets = count
        step = len(ids) / buckets
        sample_ids = []

        for b in range(buckets):
            start = int(b * step)
            end = int((b + 1) * step)
            end = min(end, len(ids))
            if start < end:
                sample_ids.append(random.choice(ids[start:end]))

    sample_ids.sort()

    for item_id in sample_ids:
        item = items[str(item_id)]
        name = item["name"]
        slot = item.get("slot", 0)
        slot_text = f" [{slot} slot(s)]" if slot > 0 else ""
        print(f"  {item_id}: {name}{slot_text}")
    print(f"")

if __name__ == "__main__":
    main()