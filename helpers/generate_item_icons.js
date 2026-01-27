const fs = require('fs');
const path = require('path');

// Paths relative to helpers/ directory
const IMAGE_DIR = path.join(__dirname, '../image/item');
const ITEMS_FILE = path.join(__dirname, '../data/osromr_items.json');
const OUTPUT_FILE = path.join(__dirname, '../data/osromr_item_icons.json');

function getAvailableIcons() {
    const icons = [];
    
    // Check if image directory exists
    if (!fs.existsSync(IMAGE_DIR)) {
        console.error(`Error: Image directory not found: ${IMAGE_DIR}`);
        return icons;
    }
    
    // Read all files in the image/item directory
    const files = fs.readdirSync(IMAGE_DIR);
    
    // Extract item IDs from .png files
    for (const file of files) {
        if (file.endsWith('.png')) {
            const itemId = file.replace('.png', '');
            // Only add if it's a valid number
            if (/^\d+$/.test(itemId)) {
                icons.push(parseInt(itemId, 10));
            }
        }
    }
    
    // Sort numerically
    icons.sort((a, b) => a - b);
    
    return icons;
}

function main() {
    console.log('Scanning image/item/ directory for item icons...');
    
    const icons = getAvailableIcons();
    
    if (icons.length === 0) {
        console.warn('Warning: No valid item icons found');
    }
    
    // Ensure data directory exists
    const dataDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Write compact JSON (single line array)
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(icons), 'utf-8');
    
    console.log(`\n✓ Generated ${OUTPUT_FILE}`);
    console.log(`✓ Found ${icons.length} item icons`);
    
    // Show sample of icons
    if (icons.length > 0) {
        const sampleCount = Math.min(20, icons.length);
        console.log(`\nSample icons (first ${sampleCount}):`);
        
        // Load items data if available to show names
        let itemsData = {};
        if (fs.existsSync(ITEMS_FILE)) {
            itemsData = JSON.parse(fs.readFileSync(ITEMS_FILE, 'utf-8'));
        }
        
        for (let i = 0; i < sampleCount; i++) {
            const id = icons[i];
            const item = itemsData[id.toString()];
            const name = item ? item.name : '(unknown)';
            console.log(`  ${id}: ${name}`);
        }
        
        if (icons.length > sampleCount) {
            console.log(`  ... and ${icons.length - sampleCount} more`);
        }
    }
}

if (require.main === module) {
    main();
}

module.exports = { getAvailableIcons };
