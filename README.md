# OSRO Quest Helper

A web-based quest management and material tracking tool for **OSRO Midrate**. Organize quests, track materials needed for crafting chains, and calculate total resource costs with ease.

## 🎮 Live Preview

**[Try it now](https://torrq.github.io/osro-quest-helper/)**

## ✨ Features

- **Quest Organization**: Organize quests into groups and subgroups for easy navigation
- **Material Tracking**: Track all materials needed for each quest
- **Crafting Chain Analysis**: Automatically calculate material requirements across linked quests
- **Multiple Currency Support**: Support for Zeny, Gold, Credits, and various point systems
- **Item Management**: Create and manage item catalogs with zeny values
- **Material Breakdown Tree**: Visualize the complete material tree with multiple crafting options
- **Summary Calculator**: Get total material costs with zeny value conversions
- **Search & Filter**: Quickly find quests and items with built-in search
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Import/Export**: Save your quest data as JSON or import from others
- **Drag & Drop**: Reorder quests within subgroups for organization

## 🚀 Quick Start

1. Visit [https://torrq.github.io/osro-quest-helper/](https://torrq.github.io/osro-quest-helper/)
2. Start creating quests or import existing quest data
3. Track materials and see the complete breakdown tree
4. Export your quest data to save locally

## 📊 Quest Editor Features

### Basic Information
- Quest name
- Produced item (ID and name)
- Success rate percentage
- Account-bound flag
- Description/effects

### Requirements
Add multiple requirement types:
- **Items**: With quantities and immunity flags
- **Zeny**: Direct currency cost
- **Gold/Credits**: Convertible currencies
- **Points**: Various point types (Vote, Hourly, Activity, etc.)

### Material Analysis
- **Breakdown Tree**: Shows all materials needed with multipliers for success rates
- **Summary View**: Complete material list with total zeny values
- **Multi-option Support**: Handles items that can be crafted through different quest chains

## 📱 Mobile Support

The app is fully responsive and optimized for mobile devices:
- Collapsible sidebar with hamburger menu
- Touch-friendly interface
- Proper spacing and padding for comfortable scrolling

## 💾 Data Format

```json
{
  "meta": {
    "creditValueZeny": 10000000,
    "creditItemId": 40001,
    "goldValueZeny": 124000,
    "goldItemId": 969
  },
  "items": {
    "969": {
      "id": 969,
      "name": "Gold",
      "value": 124000
    }
  },
  "groups": [
    {
      "name": "Group Name",
      "subgroups": [
        {
          "name": "Subgroup Name",
          "quests": [
            {
              "name": "Quest Name",
              "producesId": 969,
              "successRate": 100,
              "description": "Quest description",
              "accountBound": false,
              "requirements": [
                {
                  "type": "item",
                  "id": 1234,
                  "amount": 5,
                  "immune": false
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

## 🛠️ Development

### Local Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/torrq/osro-quest-helper.git
   cd osro-quest-helper
   ```

2. Open `index.html` in a web browser or use a local server:
   ```bash
   python -m http.server 8000
   # or
   npx http-server
   ```

3. Navigate to `http://localhost:8000`

### File Structure
```
osro-quest-helper/
├── index.html          # Main HTML file
├── style.css           # Styling and responsive design
├── script.js           # All application logic
├── osromr_quests.json  # Default quest data (for auto-import)
├── github.png          # GitHub link icon
└── osromr.jpg          # Header background image
```

### Configuration

In `script.js`, you can enable/disable auto-import:
```javascript
const AUTO_IMPORT_ON_FIRST_LOAD = true;  // Set to false to start with empty state
const AUTO_IMPORT_URL = 'https://torrq.github.io/osro-quest-helper/osromr_quests.json';
```

## 🔧 Technologies

- **HTML5**: Semantic markup
- **CSS3**: Responsive grid and flexbox layout with CSS variables
- **Vanilla JavaScript**: No dependencies, pure JavaScript implementation

## 📝 License

This project is provided as-is for the OSRO community. Check the LICENSE file for details.

## 🤝 Contributing

Found a bug or have a feature idea? Feel free to open an issue or submit a pull request!

## 📧 Support

For questions or issues, please open a GitHub issue or contact the maintainers.
