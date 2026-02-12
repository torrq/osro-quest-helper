#!/usr/bin/env python3
"""
OSRO Quest Helper - Sprite Sheet Generator
Combines all item icons into a single sprite sheet for optimal performance.

Place this script in the helpers/ directory alongside generate_item_icons.py
"""

import os
import json
from PIL import Image
from pathlib import Path

# ============================================================================
# CONFIGURATION
# ============================================================================

# Paths relative to helpers/ directory (where this script lives)
SCRIPT_DIR = Path(__file__).parent
ICON_SIZE = 24  # Size of each icon (24x24px)
ICONS_PER_ROW = 128  # Icons per row (128 icons = 3072px wide)
INPUT_DIR = SCRIPT_DIR / ".." / "image" / "item"  # Directory containing individual icon PNGs
OUTPUT_SPRITE = SCRIPT_DIR / ".." / "image" / "item_sprite.png"  # Output sprite sheet
OUTPUT_MAP = SCRIPT_DIR / ".." / "data" / "osromr_sprite_map.json"  # Output mapping file

# ============================================================================
# SPRITE GENERATION
# ============================================================================

def generate_sprite_sheet():
    """Generate sprite sheet from individual icon files."""
    
    print(f"🔍 Scanning for icons in '{INPUT_DIR}'...")
    
    # Check if image directory exists
    if not INPUT_DIR.exists():
        print(f"❌ Error: Image directory not found: {INPUT_DIR}")
        return False
    
    # Get all PNG files and extract item IDs
    icon_files = {}
    for file in INPUT_DIR.iterdir():
        if file.suffix == '.png':
            try:
                item_id = int(file.stem)
                icon_files[item_id] = file
            except ValueError:
                print(f"⚠️  Skipping non-numeric file: {file.name}")
    
    if not icon_files:
        print(f"❌ No icon files found in '{INPUT_DIR}'")
        return
    
    # Sort by ID for consistent sprite layout
    sorted_ids = sorted(icon_files.keys())
    total_icons = len(sorted_ids)
    
    print(f"✅ Found {total_icons} icon files")
    
    # Calculate sprite sheet dimensions
    rows_needed = (total_icons + ICONS_PER_ROW - 1) // ICONS_PER_ROW
    sprite_width = ICONS_PER_ROW * ICON_SIZE
    sprite_height = rows_needed * ICON_SIZE
    
    print(f"📐 Creating sprite sheet: {sprite_width}x{sprite_height}px ({rows_needed} rows)")
    
    # Create blank sprite sheet (RGBA for transparency)
    sprite = Image.new('RGBA', (sprite_width, sprite_height), (0, 0, 0, 0))
    
    # Position mapping for each icon
    sprite_map = {}
    
    # Place icons on sprite sheet
    for idx, item_id in enumerate(sorted_ids):
        try:
            # Calculate position
            col = idx % ICONS_PER_ROW
            row = idx // ICONS_PER_ROW
            x = col * ICON_SIZE
            y = row * ICON_SIZE
            
            # Load and paste icon
            icon_path = icon_files[item_id]
            icon = Image.open(icon_path)
            
            # Verify icon size
            if icon.size != (ICON_SIZE, ICON_SIZE):
                print(f"⚠️  Icon {item_id} is {icon.size}, expected {ICON_SIZE}x{ICON_SIZE} - resizing")
                icon = icon.resize((ICON_SIZE, ICON_SIZE), Image.Resampling.NEAREST)
            
            # Paste onto sprite
            sprite.paste(icon, (x, y), icon if icon.mode == 'RGBA' else None)
            
            # Store position in map
            sprite_map[str(item_id)] = [col, row]
            
            # Progress indicator
            if (idx + 1) % 500 == 0:
                print(f"⏳ Processed {idx + 1}/{total_icons} icons...")
                
        except Exception as e:
            print(f"❌ Error processing icon {item_id}: {e}")
    
    # Save sprite sheet
    print(f"💾 Saving sprite sheet to '{OUTPUT_SPRITE}'...")
    OUTPUT_SPRITE.parent.mkdir(parents=True, exist_ok=True)
    sprite.save(OUTPUT_SPRITE, 'PNG', optimize=True)
    
    # Get file size
    sprite_size_mb = OUTPUT_SPRITE.stat().st_size / (1024 * 1024)
    print(f"✅ Sprite sheet saved: {sprite_size_mb:.2f} MB")
    
    # Save mapping file
    print(f"💾 Saving sprite map to '{OUTPUT_MAP}'...")
    OUTPUT_MAP.parent.mkdir(parents=True, exist_ok=True)
    
    map_data = {
        "version": 1,
        "iconSize": ICON_SIZE,
        "iconsPerRow": ICONS_PER_ROW,
        "totalIcons": total_icons,
        "spriteWidth": sprite_width,
        "spriteHeight": sprite_height,
        "map": sprite_map
    }
    
    with open(OUTPUT_MAP, 'w') as f:
        json.dump(map_data, f, separators=(',', ':'))  # Compact JSON
    
    map_size_kb = OUTPUT_MAP.stat().st_size / 1024
    print(f"✅ Sprite map saved: {map_size_kb:.2f} KB")
    
    print(f"\n🎉 SUCCESS!")
    print(f"   Total icons: {total_icons}")
    print(f"   Sprite size: {sprite_size_mb:.2f} MB")
    print(f"   Map size: {map_size_kb:.2f} KB")
    print(f"   Performance gain: ~{total_icons} HTTP requests → 2 requests")
    
    return True

# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    try:
        generate_sprite_sheet()
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
