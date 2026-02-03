#!/usr/bin/env python3
"""
convert_iteminfo-revo.py

Convert an OSRO Revo itemInfo Lua file -> JSON (structure-aware, cp949-friendly).
"""

import re
import json
import random
import sys
from collections import defaultdict

# Edit these if needed
INPUT_FILE = "itemInfo.lua"
OUTPUT_FILE = "osrolr_items.json"

# Regexes
ITEM_START_RE = re.compile(r"\[(\d+)\]\s*=\s*{")
KEY_VALUE_RE = re.compile(r"^(\w+)\s*=\s*(.+?)(?:,\s*)?$")
STRING_RE = re.compile(r'"((?:[^"\\]|\\.)*)"')
NUMBER_RE = re.compile(r"^-?\d+$")
FLOAT_RE = re.compile(r"^-?\d+\.\d+$")
BOOLEAN_RE = re.compile(r"^(true|false)$", re.IGNORECASE)

def parse_lua_string(value):
    m = STRING_RE.search(value)
    return m.group(1) if m else None

def parse_inline_array(value):
    # extract quoted strings, and bare numbers/words as fallback
    strs = STRING_RE.findall(value)
    if strs:
        return strs
    # fallback to numbers / bare tokens
    tokens = re.findall(r"[+-]?\d+(?:\.\d+)?|\w+", value)
    return tokens

def parse_multiline_array(lines, start_index):
    """Collect array entries (quoted strings or bare tokens) spanning multiple lines.
    Returns (values_list, index_of_line_with_closing_brace)."""
    values = []
    i = start_index
    while i < len(lines):
        line = lines[i].strip()
        # end of array
        if line.startswith("}"):
            return values, i
        # collect quoted strings on this line
        matches = STRING_RE.findall(line)
        if matches:
            values.extend(matches)
        else:
            # collect numbers / tokens if no quotes
            tokens = re.findall(r"[+-]?\d+(?:\.\d+)?|\w+", line)
            if tokens:
                values.extend(tokens)
        i += 1
    return values, i

def parse_value(value, lines=None, idx=None):
    """Return a Python value (string, int, float, bool, list, or raw string) for a Lua RHS."""
    v = value.strip()
    # inline table/array
    if v.startswith("{"):
        if "}" in v:
            return parse_inline_array(v)
        # multiline array - caller should have provided lines and idx
        if lines is not None and idx is not None:
            arr, end_idx = parse_multiline_array(lines, idx + 1)
            return arr, end_idx
        return []  # fallback
    # string
    if v.startswith('"') or v.endswith('"'):
        s = parse_lua_string(v)
        return s
    # boolean
    if BOOLEAN_RE.match(v):
        return v.lower() == "true"
    # number
    if NUMBER_RE.match(v):
        try:
            return int(v)
        except Exception:
            return v
    if FLOAT_RE.match(v):
        try:
            return float(v)
        except Exception:
            return v
    # empty table or braces
    if v == "{}":
        return []
    # unknown / raw
    return v

def parse_item_block(lines, start_index):
    """Parse an item block starting at start_index (line that follows the '[ID] = {' line).
    Returns (item_dict, index_of_line_with_closing_brace)."""
    item = {}
    i = start_index
    while i < len(lines):
        raw = lines[i].rstrip("\n")
        line = raw.strip()

        # end of item block
        if line == "}," or line == "}":
            return item, i

        # skip empty lines and comments
        if not line or line.startswith("--"):
            i += 1
            continue

        kv = KEY_VALUE_RE.match(line)
        if kv:
            key, rhs = kv.groups()
            rhs = rhs.rstrip(",").strip()
            # handle multiline array/table
            if rhs.startswith("{") and not "}" in rhs:
                arr, end_i = parse_multiline_array(lines, i + 1)
                item[key] = arr
                i = end_i  # parse_multiline_array returns index of line with '}', we'll increment below
            else:
                val = parse_value(rhs)
                # parse_value may return a tuple when caller forgot to provide lines/idx for multiline arrays,
                # but in our code above we handled multiline arrays explicitly.
                item[key] = val
        else:
            # line didn't match key=value (possible stray tokens). Try to collect quoted strings if any
            matches = STRING_RE.findall(line)
            if matches:
                # store under a synthetic key so data isn't lost (rare)
                item.setdefault("_extra_strings", []).extend(matches)

        i += 1

    return item, i

def convert_lua_to_json(text):
    lines = text.splitlines()
    items = {}
    i = 0
    while i < len(lines):
        line = lines[i]
        m = ITEM_START_RE.search(line)
        if not m:
            i += 1
            continue
        item_id = int(m.group(1))
        # parse block starting at next line
        block_start = i + 1
        item_data, end_i = parse_item_block(lines, block_start)
        i = end_i + 1

        # build normalized output in the same style as user's converter (name + desc + slot),
        # but keep additional useful fields too.
        # Prefer identifiedDisplayName -> unidentifiedDisplayName as 'name' for compatibility.
        name = item_data.get("identifiedDisplayName") or item_data.get("unidentifiedDisplayName")
        desc_arr = item_data.get("identifiedDescriptionName") or item_data.get("unidentifiedDescriptionName") or []
        desc = "\n".join(desc_arr) if isinstance(desc_arr, list) else (desc_arr or "")

        out = {
            "name": name,
            "desc": desc
        }

        # numeric/boolean fields
        slot = item_data.get("slotCount", 0)
        try:
            slot = int(slot)
        except (TypeError, ValueError):
            slot = 0

        if slot > 0:
            out["slot"] = slot

        # ONLY add costume if true
        if item_data.get("costume") is True:
            out["costume"] = True

        items[str(item_id)] = out

    return items

def main():
    # try encodings (cp949 first, since RO files are often CP949)
    text = None
    for enc in ("cp949", "utf-8", "latin-1"):
        try:
            with open(INPUT_FILE, "r", encoding="cp949", errors="replace") as f:
                text = f.read()
            print(f"Read {INPUT_FILE} as cp949 (surrogateescape)")
            break
        except FileNotFoundError:
            print(f"Input file not found: {INPUT_FILE}")
            return
        except UnicodeDecodeError:
            print(f"Encoding {enc} failed, trying next...")
            continue

    if text is None:
        print("Failed to read input file with available encodings.")
        return

    items = convert_lua_to_json(text)

    # sort by numeric id
    items = dict(sorted(items.items(), key=lambda kv: int(kv[0])))

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)

    print(f"Converted {len(items)} items -> {OUTPUT_FILE}")

    # Balanced random sample output (like your other script)
    ids = sorted(int(i) for i in items.keys())
    sample_count = min(10, len(ids))
    if sample_count == 0:
        print("No items parsed.")
        return

    # choose samples evenly across the ID range
    if len(ids) <= sample_count:
        sample_ids = ids
    else:
        buckets = sample_count
        step = len(ids) / buckets
        sample_ids = []
        for b in range(buckets):
            start = int(b * step)
            end = int((b + 1) * step)
            end = min(end, len(ids))
            if start < end:
                sample_ids.append(random.choice(ids[start:end]))
        sample_ids.sort()

    print("\nRandom samples:\n")
    for sid in sample_ids:
        item = items[str(sid)]
        name = item.get("name") or item.get("identifiedDisplayName") or item.get("unidentifiedDisplayName") or "(no name)"
        slot = item.get("slot", 0)
        slot_text = f" [{slot} slot(s)]" if slot else ""
        print(f"  {sid}: {name}{slot_text}")
    print("")

if __name__ == "__main__":
    # allow passing input/output filenames on CLI if desired
    if len(sys.argv) >= 2:
        INPUT_FILE = sys.argv[1]
    if len(sys.argv) >= 3:
        OUTPUT_FILE = sys.argv[2]
    main()
