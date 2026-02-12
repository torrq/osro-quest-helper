#!/usr/bin/env python3
"""
OSRO Quest Helper - Sprite Sheet Verification Tool
Verifies that the sprite sheet and mapping are correct.

Place this script in the helpers/ directory alongside generate_item_icons.py
"""

import os
import json
from PIL import Image
from pathlib import Path

# Paths relative to helpers/ directory (where this script lives)
SCRIPT_DIR = Path(__file__).parent
SPRITE_PATH = SCRIPT_DIR / ".." / "image" / "item_sprite.png"
MAP_PATH = SCRIPT_DIR / ".." / "data" / "osromr_sprite_map.json"
ICON_DIR = SCRIPT_DIR / ".." / "image" / "item"

def verify_sprite_sheet():
    """Verify sprite sheet integrity."""
    print("🔍 OSRO Sprite Sheet Verification")
    print("=" * 60)
    
    errors = []
    warnings = []
    
    # Check if files exist
    print("\n1. Checking files...")
    if not SPRITE_PATH.exists():
        errors.append(f"❌ Sprite sheet not found: {SPRITE_PATH}")
    else:
        print(f"   ✅ Sprite sheet exists: {SPRITE_PATH}")
        
    if not MAP_PATH.exists():
        errors.append(f"❌ Sprite map not found: {MAP_PATH}")
    else:
        print(f"   ✅ Sprite map exists: {MAP_PATH}")
    
    if errors:
        print("\n" + "\n".join(errors))
        return False
    
    # Load and verify sprite map
    print("\n2. Validating sprite map...")
    try:
        with open(MAP_PATH, 'r') as f:
            sprite_map = json.load(f)
        
        required_keys = ['version', 'iconSize', 'iconsPerRow', 'totalIcons', 'map']
        for key in required_keys:
            if key not in sprite_map:
                errors.append(f"❌ Sprite map missing key: {key}")
        
        if not errors:
            print(f"   ✅ Map version: {sprite_map['version']}")
            print(f"   ✅ Icon size: {sprite_map['iconSize']}px")
            print(f"   ✅ Icons per row: {sprite_map['iconsPerRow']}")
            print(f"   ✅ Total icons: {sprite_map['totalIcons']}")
            print(f"   ✅ Map entries: {len(sprite_map['map'])}")
            
            if sprite_map['totalIcons'] != len(sprite_map['map']):
                warnings.append(f"⚠️  Total icons ({sprite_map['totalIcons']}) doesn't match map entries ({len(sprite_map['map'])})")
    
    except json.JSONDecodeError as e:
        errors.append(f"❌ Invalid JSON in sprite map: {e}")
    except Exception as e:
        errors.append(f"❌ Error reading sprite map: {e}")
    
    # Verify sprite image
    print("\n3. Validating sprite image...")
    try:
        sprite = Image.open(SPRITE_PATH)
        width, height = sprite.size
        mode = sprite.mode
        
        print(f"   ✅ Image size: {width}x{height}px")
        print(f"   ✅ Color mode: {mode}")
        
        if mode != 'RGBA':
            warnings.append(f"⚠️  Expected RGBA mode, got {mode}")
        
        expected_width = sprite_map['iconsPerRow'] * sprite_map['iconSize']
        if width != expected_width:
            errors.append(f"❌ Width mismatch: expected {expected_width}px, got {width}px")
        
        # Calculate file size
        size_mb = SPRITE_PATH.stat().st_size / (1024 * 1024)
        print(f"   ✅ File size: {size_mb:.2f} MB")
        
        if size_mb > 5:
            warnings.append(f"⚠️  Large file size: {size_mb:.2f} MB (consider compression)")
    
    except Exception as e:
        errors.append(f"❌ Error reading sprite image: {e}")
    
    # Sample icon positions
    print("\n4. Verifying icon positions...")
    try:
        sample_ids = list(sprite_map['map'].keys())[:5]
        for item_id in sample_ids:
            col, row = sprite_map['map'][item_id]
            x = col * sprite_map['iconSize']
            y = row * sprite_map['iconSize']
            print(f"   ✅ Item {item_id}: position ({col}, {row}) = pixel ({x}, {y})")
    except Exception as e:
        warnings.append(f"⚠️  Error verifying positions: {e}")
    
    # Compare with source icons
    print("\n5. Comparing with source icons...")
    if ICON_DIR.exists():
        icon_files = [f for f in ICON_DIR.iterdir() if f.suffix == '.png']
        icon_count = len(icon_files)
        map_count = len(sprite_map['map'])
        
        print(f"   ℹ️  Source icons: {icon_count}")
        print(f"   ℹ️  Sprite map icons: {map_count}")
        
        if icon_count > map_count:
            warnings.append(f"⚠️  Some source icons not in sprite ({icon_count - map_count} missing)")
        elif map_count > icon_count:
            warnings.append(f"⚠️  Sprite has more icons than source ({map_count - icon_count} extra)")
        else:
            print(f"   ✅ Icon counts match!")
    else:
        warnings.append(f"⚠️  Source icon directory not found: {ICON_DIR}")
    
    # Print summary
    print("\n" + "=" * 60)
    print("📊 VERIFICATION SUMMARY")
    print("=" * 60)
    
    if errors:
        print(f"\n❌ FAILED - {len(errors)} error(s) found:")
        for error in errors:
            print(f"   {error}")
    else:
        print("\n✅ All critical checks passed!")
    
    if warnings:
        print(f"\n⚠️  {len(warnings)} warning(s):")
        for warning in warnings:
            print(f"   {warning}")
    
    if not errors and not warnings:
        print("\n🎉 Perfect! Sprite sheet is ready to use.")
        print("\nNext steps:")
        print("1. Update config.js with sprite map URL")
        print("2. Update main.js with sprite loading code")
        print("3. Add sprite CSS to your stylesheet")
        print("4. Upload files and test")
    
    return len(errors) == 0

if __name__ == "__main__":
    try:
        success = verify_sprite_sheet()
        exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
