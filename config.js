// === AUTO-IMPORT CONFIGURATION ===
const AUTO_IMPORT_ON_FIRST_LOAD = true;
const USE_LOCAL_SERVER = true; // Set to true for local files, false for GitHub URLs

const REMOTE_URLS = {
  items: 'https://torrq.github.io/osro-quest-helper/data/osromr_items.json',
  values: 'https://torrq.github.io/osro-quest-helper/data/osromr_item_values.json',
  quests: 'https://torrq.github.io/osro-quest-helper/data/osromr_quests.json'
};

const LOCAL_URLS = {
  items: 'http://127.0.0.1:8000/data/osromr_items.json',
  values: 'http://127.0.0.1:8000/data/osromr_item_values.json',
  quests: 'http://127.0.0.1:8000/data/osromr_quests.json'
};

// Select the source based on the toggle
const AUTO_IMPORT_URLS = USE_LOCAL_SERVER ? LOCAL_URLS : REMOTE_URLS;

// Special item IDs - used to identify credit/gold for calculations
const SPECIAL_ITEMS = {
  CREDIT: 40001,
  GOLD: 969
};

// Helper functions to get dynamic values from item database
function getCreditValue() {
  return DATA.items[SPECIAL_ITEMS.CREDIT]?.value || 0;
}

function getGoldValue() {
  return DATA.items[SPECIAL_ITEMS.GOLD]?.value || 0;
}