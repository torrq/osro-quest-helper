import json
import re

# Load the JSON file
with open('osromr_items.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Set to store unique colors
unique_colors = set()

# Iterate through each item
for item in data.values():
    desc = item.get('desc', '')
    # Find all color codes matching ^ followed by 6 hex digits
    matches = re.findall(r'\^([0-9A-Fa-f]{6})', desc)
    for color in matches:
        unique_colors.add(color.upper())  # Standardize to uppercase

# Convert set to sorted list
unique_colors_list = sorted(list(unique_colors))

# Print the list
print(unique_colors_list)