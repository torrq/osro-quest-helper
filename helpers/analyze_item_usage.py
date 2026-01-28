import json
from pathlib import Path
from collections import defaultdict
import argparse

# Paths
SCRIPT_DIR = Path(__file__).parent
QUESTS_FILE = SCRIPT_DIR / ".." / "data" / "osromr_quests.json"
ITEMS_FILE = SCRIPT_DIR / ".." / "data" / "osromr_items.json"
OUTPUT_FILE = SCRIPT_DIR / ".." / "data" / "osromr_item_usage.json"


def analyze_item_usage(quests_data, items_data, exclude_groups=None):
    """
    Analyze item usage across all quests.
    
    Args:
        quests_data: Quest database
        items_data: Item database
        exclude_groups: List of group names to exclude from analysis
    
    Returns a dict with item IDs as keys, containing:
    - item_id: The item's ID
    - name: Item name from items database
    - quest_count: Number of quests that require this item
    - total_amount: Total quantity required across all quests
    - avg_amount: Average amount per quest
    - quests: List of quests that use this item (with amounts)
    """
    if exclude_groups is None:
        exclude_groups = []
    
    usage = defaultdict(lambda: {
        'quest_count': 0,
        'total_amount': 0,
        'quests': []
    })
    
    skipped_count = 0
    processed_count = 0
    
    # Traverse all groups -> subgroups -> quests
    for group in quests_data.get('groups', []):
        group_name = group.get('name', '')
        
        # Skip excluded groups
        if group_name in exclude_groups:
            skipped_count += 1
            continue
        
        processed_count += 1
        
        for subgroup in group.get('subgroups', []):
            for quest in subgroup.get('quests', []):
                quest_name = quest.get('name', 'Unknown Quest')
                
                # Check all requirements
                for req in quest.get('requirements', []):
                    if req.get('type') == 'item':
                        item_id = req.get('id')
                        
                        # Skip if no valid item ID
                        if item_id is None:
                            continue
                        
                        item_id = str(item_id)
                        amount = req.get('amount', 1)
                        
                        # Update usage stats
                        usage[item_id]['quest_count'] += 1
                        usage[item_id]['total_amount'] += amount
                        usage[item_id]['quests'].append({
                            'quest': quest_name,
                            'amount': amount,
                            'group': group.get('name', ''),
                            'subgroup': subgroup.get('name', '')
                        })
    
    # Print processing summary if groups were excluded
    if exclude_groups:
        print(f"  Processed {processed_count} groups, skipped {skipped_count} groups")
    
    # Build final result with item names and calculated stats
    result = {}
    for item_id, stats in usage.items():
        item_info = items_data.get(item_id, {})
        
        result[item_id] = {
            'item_id': int(item_id),
            'name': item_info.get('name', f'Unknown Item ({item_id})'),
            'quest_count': stats['quest_count'],
            'total_amount': stats['total_amount'],
            'avg_amount': round(stats['total_amount'] / stats['quest_count'], 2),
            'quests': stats['quests']
        }
    
    return result


def generate_summary_stats(usage_data):
    """Generate summary statistics about item usage"""
    if not usage_data:
        return {}
    
    items_list = list(usage_data.values())
    
    # Sort by different metrics
    by_quest_count = sorted(items_list, key=lambda x: x['quest_count'], reverse=True)
    by_total_amount = sorted(items_list, key=lambda x: x['total_amount'], reverse=True)
    by_avg_amount = sorted(items_list, key=lambda x: x['avg_amount'], reverse=True)
    
    return {
        'total_unique_items': len(items_list),
        'total_item_requirements': sum(item['quest_count'] for item in items_list),
        'total_items_needed': sum(item['total_amount'] for item in items_list),
        'top_by_quest_count': [
            {
                'item_id': item['item_id'],
                'name': item['name'],
                'quest_count': item['quest_count']
            }
            for item in by_quest_count[:10]
        ],
        'top_by_total_amount': [
            {
                'item_id': item['item_id'],
                'name': item['name'],
                'total_amount': item['total_amount']
            }
            for item in by_total_amount[:10]
        ],
        'top_by_avg_amount': [
            {
                'item_id': item['item_id'],
                'name': item['name'],
                'avg_amount': item['avg_amount'],
                'quest_count': item['quest_count']
            }
            for item in by_avg_amount[:10]
        ]
    }


def main():
    # Parse command-line arguments
    parser = argparse.ArgumentParser(
        description='Analyze item usage across quests',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python analyze_item_usage.py                    # Analyze all quests
  python analyze_item_usage.py --exclude-classic  # Exclude Classic Headgear group
        """
    )
    parser.add_argument(
        '--exclude-classic',
        action='store_true',
        help='Exclude the "Classic Headgear" group from analysis'
    )
    
    args = parser.parse_args()
    
    # Build exclude list
    exclude_groups = []
    if args.exclude_classic:
        exclude_groups.append('Classic Headgear')
        print("📌 Excluding 'Classic Headgear' group from analysis")
    
    print("Analyzing item usage in quests...")
    
    # Load quests data
    if not QUESTS_FILE.exists():
        print(f"Error: Quests file not found: {QUESTS_FILE}")
        return
    
    with open(QUESTS_FILE, "r", encoding="utf-8") as f:
        quests_data = json.load(f)
    
    # Load items data
    items_data = {}
    if ITEMS_FILE.exists():
        with open(ITEMS_FILE, "r", encoding="utf-8") as f:
            items_data = json.load(f)
    else:
        print("Warning: Items file not found, item names will be unknown")
    
    # Analyze usage
    usage_data = analyze_item_usage(quests_data, items_data, exclude_groups)
    summary = generate_summary_stats(usage_data)
    
    # Prepare output
    output = {
        'summary': summary,
        'items': usage_data
    }
    
    # Ensure data directory exists
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    
    # Write results
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Generated {OUTPUT_FILE}")
    print(f"✓ Analyzed {len(usage_data)} unique items across quests")
    
    # Display summary
    if summary:
        print(f"\n📊 Summary Statistics:")
        print(f"  Total unique items used: {summary['total_unique_items']}")
        print(f"  Total item requirements: {summary['total_item_requirements']}")
        print(f"  Total items needed: {summary['total_items_needed']:,}")
        
        print(f"\n🔝 Top 10 Most Frequently Required Items:")
        for i, item in enumerate(summary['top_by_quest_count'][:10], 1):
            print(f"  {i}. {item['name']} - used in {item['quest_count']} quests")
        
        print(f"\n📦 Top 10 Items by Total Volume:")
        for i, item in enumerate(summary['top_by_total_amount'][:10], 1):
            print(f"  {i}. {item['name']} - {item['total_amount']:,} total needed")
        
        print(f"\n💎 Top 10 Items by Average Amount per Quest:")
        for i, item in enumerate(summary['top_by_avg_amount'][:10], 1):
            print(f"  {i}. {item['name']} - avg {item['avg_amount']:,.1f} per quest ({item['quest_count']} quests)")


if __name__ == "__main__":
    main()
