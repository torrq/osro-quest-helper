// ============================================================================
// OSRO Quest Helper - Configuration
// ============================================================================

const VERSION = 112;
const FLAVOR = 'Midrate';

// === DATA SOURCE CONFIGURATION ===

// Toggle between local development server and production GitHub URLs
const USE_LOCAL_SERVER = false; 

// Auto-import data on page load (disable if you want to manually import)
const AUTO_IMPORT_ON_FIRST_LOAD = true;

// GitHub Pages URLs (Production)
const REMOTE_URLS = {
  items: "https://torrq.github.io/osro-quest-helper/data/osromr_items.json",
  newItems: "https://torrq.github.io/osro-quest-helper/data/osromr_items_new.json",
  values: "https://torrq.github.io/osro-quest-helper/data/osromr_item_values.json",
  quests: "https://torrq.github.io/osro-quest-helper/data/osromr_quests.json",
  shops: "https://torrq.github.io/osro-quest-helper/data/osromr_shops.json",
  icons: "https://torrq.github.io/osro-quest-helper/data/osromr_item_icons.json",
  searchIndexName: "https://torrq.github.io/osro-quest-helper/data/osromr_search_index_name.json",
  searchIndexDesc: "https://torrq.github.io/osro-quest-helper/data/osromr_search_index_desc.json",
  spriteMap: "https://torrq.github.io/osro-quest-helper/data/osromr_sprite_map.json"
};

// Local Development URLs (for testing with local server)
// Run with: python -m http.server 8000
const LOCAL_URLS = {
  items: "http://127.0.0.1:8298/data/osromr_items.json",
  newItems: "http://127.0.0.1:8298/data/osromr_items_new.json",
  values: "http://127.0.0.1:8298/data/osromr_item_values.json",
  quests: "http://127.0.0.1:8298/data/osromr_quests.json",
  shops: "http://127.0.0.1:8298/data/osromr_shops.json",
  icons: "http://127.0.0.1:8298/data/osromr_item_icons.json",
  searchIndexName: "http://127.0.0.1:8298/data/osromr_search_index_name.json",
  searchIndexDesc: "http://127.0.0.1:8298/data/osromr_search_index_desc.json",
  spriteMap: "http://127.0.0.1:8298/data/osromr_sprite_map.json"
};

// Active URLs based on USE_LOCAL_SERVER toggle
const AUTO_IMPORT_URLS = USE_LOCAL_SERVER ? LOCAL_URLS : REMOTE_URLS;

// === SPECIAL ITEM IDS ===

// These items are used as currency in the game
const SPECIAL_ITEMS = {
  CREDIT: 40001,  // Credits
  GOLD: 969,      // Gold
};

// === HELPER FUNCTIONS ===

/**
 * Get the current zeny value of Credits from the items database
 * @returns {number} Zeny value per Credit
 */
function getCreditValue() {
  return DATA.items[SPECIAL_ITEMS.CREDIT]?.value || 0;
}

/**
 * Get the current zeny value of Gold from the items database
 * @returns {number} Zeny value per Gold
 */
function getGoldValue() {
  return DATA.items[SPECIAL_ITEMS.GOLD]?.value || 0;
}

// === DEVELOPMENT MODE ===

// Log configuration on load (useful for debugging)
if (typeof console !== 'undefined') {
  console.log('[Config] Data source:', USE_LOCAL_SERVER ? 'LOCAL' : 'REMOTE');
  console.log('[Config] Auto-import:', AUTO_IMPORT_ON_FIRST_LOAD ? 'ENABLED' : 'DISABLED');
}