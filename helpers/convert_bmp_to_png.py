#!/usr/bin/env python3
"""
convert_bmp_to_png.py

Convert 8-bit BMP item icons to transparent PNGs, named by item ID.
Uses itemInfo_EN.lub to map resource names to item IDs.
Converts pink (255,0,255) to transparent.

USAGE:
1. Place this script in a directory
2. Place itemInfo_EN.lub in the same directory
3. Place BMP icons in an 'item' subdirectory (item/*.bmp)
4. Run: python convert_bmp_to_png.py
5. Output PNGs will be created in 'item_png' subdirectory

The script tries identifiedResourceName first, falls back to unidentifiedResourceName.
Case-insensitive BMP matching is used.
"""

import re
import json
from pathlib import Path
from PIL import Image

# Paths
SCRIPT_DIR = Path(__file__).parent
INPUT_FILE = "itemInfo_EN.lub"
ITEM_DIR = SCRIPT_DIR / "item"
OUTPUT_DIR = SCRIPT_DIR / "item_png"

ITEM_START_RE = re.compile(r"\[(\d+)\]\s*=\s*{")
KEY_VALUE_RE = re.compile(r"^(\w+)\s*=\s*(.+?)(?:,\s*)?$")
STRING_RE = re.compile(r'"((?:[^"\\]|\\.)*)"')

def parse_lua_string(value):
    """Extract a single string value"""
    m = STRING_RE.search(value)
    return m.group(1) if m else None

def parse_item_block(lines, start_index):
    """Parse a complete item block and return all its properties"""
    item_data = {}
    i = start_index
    brace_depth = 1  # We're already inside the item's opening brace

    while i < len(lines):
        line = lines[i].strip()

        # Track brace depth to know when item block actually ends
        if "{" in line:
            brace_depth += line.count("{")
        if "}" in line:
            brace_depth -= line.count("}")
            if brace_depth == 0:
                break

        kv = KEY_VALUE_RE.match(line)
        if kv:
            key, value = kv.groups()
            value = value.rstrip(',').strip()

            # Parse both identified and unidentified resource names
            if key in ["identifiedResourceName", "unidentifiedResourceName"]:
                if value.startswith('"'):
                    item_data[key] = parse_lua_string(value)

        i += 1

    return item_data, i

def extract_resource_mappings(text):
    """Extract item_id -> (identifiedResourceName, unidentifiedResourceName) mappings"""
    lines = text.splitlines()
    mappings = {}
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

        # Store both resource names if at least one exists
        identified = item_data.get("identifiedResourceName")
        unidentified = item_data.get("unidentifiedResourceName")
        
        if identified or unidentified:
            mappings[item_id] = (identified, unidentified)

    return mappings

def convert_bmp_to_png(bmp_path, png_path, transparent_color=(255, 0, 255)):
    """Convert BMP to PNG with transparency"""
    try:
        img = Image.open(bmp_path)
        
        # Convert to RGBA if not already
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        # Access pixels directly using load()
        pixels = img.load()
        width, height = img.size
        
        # Replace pink with transparent
        for y in range(height):
            for x in range(width):
                pixel = pixels[x, y]
                # Check if pixel matches transparent color (RGB)
                if pixel[:3] == transparent_color:
                    pixels[x, y] = (255, 0, 255, 0)  # Fully transparent
        
        img.save(png_path, 'PNG')
        return True
    except Exception as e:
        print(f"  Error converting {bmp_path.name}: {e}")
        return False

def main():
    # Validate required files and directories exist
    input_path = SCRIPT_DIR / INPUT_FILE
    if not input_path.exists():
        print(f"ERROR: '{INPUT_FILE}' not found!")
        print(f"\nUSAGE:")
        print(f"1. Place this script in a directory")
        print(f"2. Place '{INPUT_FILE}' in the same directory")
        print(f"3. Place BMP icons in '{ITEM_DIR.name}' subdirectory ({ITEM_DIR.name}/*.bmp)")
        print(f"4. Run: python {Path(__file__).name}")
        print(f"5. Output PNGs will be created in '{OUTPUT_DIR.name}' subdirectory")
        return

    if not ITEM_DIR.exists():
        print(f"ERROR: '{ITEM_DIR.name}' directory not found!")
        print(f"\nUSAGE:")
        print(f"1. Create '{ITEM_DIR.name}' subdirectory: {ITEM_DIR}")
        print(f"2. Place BMP icon files inside it ({ITEM_DIR.name}/*.bmp)")
        print(f"3. Run: python {Path(__file__).name}")
        return

    # Read itemInfo_EN.lub
    text = ""
    for encoding in ["cp949", "utf-8", "latin-1"]:
        try:
            with open(input_path, "r", encoding=encoding) as f:
                text = f.read()
            print(f"Successfully read \"{INPUT_FILE}\" with {encoding} encoding")
            break
        except UnicodeDecodeError:
            continue
        except Exception as e:
            print(f"Error reading file: {e}")
            return

    # Extract mappings
    mappings = extract_resource_mappings(text)
    print(f"Found {len(mappings)} items with resource names\n")

    # Create output directory
    OUTPUT_DIR.mkdir(exist_ok=True)

    # Get all existing BMP files (case-insensitive lookup)
    bmp_lookup = {}  # lowercase_name -> actual_filename
    if ITEM_DIR.exists():
        for f in ITEM_DIR.glob("*.bmp"):
            bmp_lookup[f.stem.lower()] = f.stem
    print(f"Found {len(bmp_lookup)} BMP files in {ITEM_DIR}\n")

    # Track conversions and misses
    converted = 0
    missing_count = 0
    used_bmps = set()  # Track which BMPs we actually used
    used_unidentified = 0

    for item_id, (identified_res, unidentified_res) in sorted(mappings.items()):
        png_path = OUTPUT_DIR / f"{item_id}.png"
        
        # Try identified resource name first (case-insensitive)
        actual_bmp_name = None
        used_fallback = False
        
        if identified_res:
            actual_bmp_name = bmp_lookup.get(identified_res.lower())
            if actual_bmp_name:
                used_bmps.add(actual_bmp_name)
        
        # Fall back to unidentified if identified doesn't exist
        if not actual_bmp_name and unidentified_res:
            actual_bmp_name = bmp_lookup.get(unidentified_res.lower())
            if actual_bmp_name:
                used_bmps.add(actual_bmp_name)
                used_fallback = True
                used_unidentified += 1

        # Check if we found a BMP
        if not actual_bmp_name:
            missing_count += 1
            continue

        bmp_path = ITEM_DIR / f"{actual_bmp_name}.bmp"
        if convert_bmp_to_png(bmp_path, png_path):
            converted += 1
            fallback_note = " [using unidentified]" if used_fallback else ""
            print(f"  {item_id}: {actual_bmp_name}.bmp → {item_id}.png{fallback_note}")

    # Find unreferenced BMPs
    unreferenced_bmps = set(bmp_lookup.values()) - used_bmps

    # Write unreferenced BMPs log
    if unreferenced_bmps:
        unreferenced_log = SCRIPT_DIR / "unreferenced_bmps.txt"
        with open(unreferenced_log, "w", encoding="utf-8") as f:
            f.write(f"Unreferenced BMP files ({len(unreferenced_bmps)} total)\n")
            f.write("=" * 60 + "\n\n")
            for bmp_name in sorted(unreferenced_bmps):
                f.write(f"{bmp_name}.bmp\n")
        print(f"\n→ Unreferenced BMPs logged to: {unreferenced_log}")

    print(f"\nConversion complete:")
    print(f"  Converted: {converted}")
    print(f"  Used unidentified fallback: {used_unidentified}")
    print(f"  Missing BMPs: {missing_count}")
    print(f"  Unreferenced BMPs: {len(unreferenced_bmps)}")
    print(f"  Output directory: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
