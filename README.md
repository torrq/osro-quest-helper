<p align="center"><img width="200" height="80" alt="osro_quests_logo_200" src="https://github.com/user-attachments/assets/056cbf00-7ca9-4afc-843f-6a9697a72d64" /></p>

# OSRO Quests 

A web-based quest, material and autoloot management tool for [OSRO Midrate](https://osro.mr). Organize quests, track materials needed for crafting chains, generate @alootid2 commands, and calculate total resource costs with ease.

## 🎮 Live Page

**Try it now! [https://torrq.github.io/osro-quest-helper](https://torrq.github.io/osro-quest-helper)**

<img width="1564" height="660" alt="image" src="https://github.com/user-attachments/assets/f6ac6d25-054a-434a-82a5-eaf90077a193" />

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
