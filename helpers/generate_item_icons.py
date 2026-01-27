import json
import os
from pathlib import Path

# Paths relative to helpers/ directory
SCRIPT_DIR = Path(__file__).parent
IMAGE_DIR = SCRIPT_DIR / ".." / "image" / "item"
ITEMS_FILE = SCRIPT_DIR / ".." / "data" / "osromr_items.json"
OUTPUT_FILE = SCRIPT_DIR / ".." / "data" / "osromr_item_icons.json"

def get_available_icons():
    """Scan image/item directory and return list of item IDs that have icons"""
    icons = []
    
    # Check if image directory exists
    if not IMAGE_DIR.exists():
        print(f"Error: Image directory not found: {IMAGE_DIR}")
        return icons
    
    # Extract item IDs from .png files
    for file in IMAGE_DIR.iterdir():
        if file.suffix == '.png':
            item_id = file.stem
            # Only add if it's a valid number
            if item_id.isdigit():
                icons.append(int(item_id))
    
    # Sort numerically
    icons.sort()
    
    return icons

def main():
    print("\nScanning image/item/ directory for item icons...")
    
    icons = get_available_icons()
    
    if len(icons) == 0:
        print("Warning: No valid item icons found")
    
    # Ensure data directory exists
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    
    # Write compact JSON (single line array)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(icons, f, separators=(',', ':'))
    
    print(f"\n✓ Generated {OUTPUT_FILE}")
    print(f"✓ Found {len(icons)} item icons\n")

if __name__ == "__main__":
    main()