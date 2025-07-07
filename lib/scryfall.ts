import axios from 'axios';

// Scryfall API base URL
const SCRYFALL_API = 'https://api.scryfall.com';

// In-memory cache for API responses
const cache = new Map<string, any>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes for in-memory cache

// Persistent localStorage cache configuration
const PERSISTENT_CACHE_KEY = 'scryfall_image_cache';
const PERSISTENT_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days for persistent cache

interface CacheEntry {
  data: any;
  timestamp: number;
}

interface PersistentCacheEntry {
  data: any;
  timestamp: number;
  url: string;
}

// Persistent cache management
function getPersistentCache(): Map<string, PersistentCacheEntry> {
  // Check if we're in browser environment
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return new Map();
  }
  
  try {
    const cached = localStorage.getItem(PERSISTENT_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      return new Map(Object.entries(parsed));
    }
  } catch (error) {
    console.warn('Failed to load persistent cache:', error);
  }
  return new Map();
}

function setPersistentCache(cache: Map<string, PersistentCacheEntry>) {
  // Check if we're in browser environment
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }
  
  try {
    const obj = Object.fromEntries(cache);
    localStorage.setItem(PERSISTENT_CACHE_KEY, JSON.stringify(obj));
  } catch (error) {
    console.warn('Failed to save persistent cache:', error);
  }
}

function cleanupPersistentCache() {
  // Check if we're in browser environment
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }
  
  const cache = getPersistentCache();
  const now = Date.now();
  let cleaned = false;
  
  for (const [key, entry] of Array.from(cache.entries())) {
    if (now - entry.timestamp > PERSISTENT_CACHE_DURATION) {
      cache.delete(key);
      cleaned = true;
    }
  }
  
  if (cleaned) {
    setPersistentCache(cache);
  }
}

// Helper to get cached data with persistent fallback
async function getCached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  // Check in-memory cache first
  const memCached = cache.get(key) as CacheEntry;
  if (memCached && Date.now() - memCached.timestamp < CACHE_DURATION) {
    return memCached.data;
  }
  
  // Check persistent cache for image URLs
  if (key.startsWith('card:') || key.startsWith('best-image:')) {
    const persistentCache = getPersistentCache();
    const persistentCached = persistentCache.get(key);
    if (persistentCached && Date.now() - persistentCached.timestamp < PERSISTENT_CACHE_DURATION) {
      // Update in-memory cache too
      cache.set(key, { data: persistentCached.data, timestamp: Date.now() });
      return persistentCached.data;
    }
  }
  
  // Fetch new data
  const data = await fetcher();
  
  // Store in in-memory cache
  cache.set(key, { data, timestamp: Date.now() });
  
  // Store in persistent cache if it's image-related data
  if ((key.startsWith('card:') || key.startsWith('best-image:')) && data && typeof data === 'object' && 'image_uris' in data && data.image_uris && typeof data.image_uris === 'object' && 'small' in data.image_uris) {
    const persistentCache = getPersistentCache();
    persistentCache.set(key, {
      data,
      timestamp: Date.now(),
      url: (data as any).image_uris.small
    });
    setPersistentCache(persistentCache);
  }
  
  return data;
}

// Cleanup persistent cache on initialization (client-side only)
if (typeof window !== 'undefined') {
  cleanupPersistentCache();
}

// Rate limiting helper
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
let lastRequest = 0;
const MIN_DELAY = 75; // 75ms between requests (more aggressive for better UX)

async function rateLimitedRequest<T>(request: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequest;
  if (timeSinceLastRequest < MIN_DELAY) {
    await delay(MIN_DELAY - timeSinceLastRequest);
  }
  lastRequest = Date.now();
  return request();
}

export interface ScryfallCard {
  id: string;
  name: string;
  mana_cost?: string;
  cmc: number;
  type_line: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  colors: string[];
  color_identity: string[];
  rarity: string;
  set: string;
  set_name: string;
  collector_number: string;
  released_at: string;
  image_uris?: {
    small: string;
    normal: string;
    large: string;
    png: string;
    art_crop: string;
    border_crop: string;
  };
  card_faces?: Array<{
    name: string;
    mana_cost?: string;
    type_line: string;
    oracle_text?: string;
    image_uris?: {
      small: string;
      normal: string;
      large: string;
      png: string;
      art_crop: string;
      border_crop: string;
    };
  }>;
  prices: {
    usd?: string;
    usd_foil?: string;
    eur?: string;
    eur_foil?: string;
  };
  legalities: Record<string, string>;
  edhrec_rank?: number;
  related_uris: {
    edhrec: string;
    tcgplayer_infinite_articles: string;
    tcgplayer_infinite_decks: string;
  };
}

export interface ScryfallSearchResult {
  data: ScryfallCard[];
  has_more: boolean;
  next_page?: string;
  total_cards: number;
}

// Enhanced collection to set code mapping
const COLLECTION_TO_SET_MAP: Record<string, string> = {
  // Recent Standard Sets
  'DUSKMOURN: HOUSE OF HORROR': 'DSK',
  'BLOOMBURROW': 'BLB',
  'OUTLAWS OF THUNDER JUNCTION': 'OTJ',
  'MURDERS AT KARLOV MANOR': 'MKM',
  'THE LOST CAVERNS OF IXALAN': 'LCI',
  'WILDS OF ELDRAINE': 'WOE',
  'MARCH OF THE MACHINE': 'MOM',
  'MARCH OF THE MACHINE: THE AFTERMATH': 'MAT',
  'PHYREXIA: ALL WILL BE ONE': 'ONE',
  'THE BROTHERS\' WAR': 'BRO',
  'DOMINARIA UNITED': 'DMU',
  'STREETS OF NEW CAPENNA': 'SNC',
  'KAMIGAWA: NEON DYNASTY': 'NEO',
  'INNISTRAD: CRIMSON VOW': 'VOW',
  'INNISTRAD: MIDNIGHT HUNT': 'MID',
  'ADVENTURES IN THE FORGOTTEN REALMS': 'AFR',
  'STRIXHAVEN: SCHOOL OF MAGES': 'STX',
  'KALDHEIM': 'KHM',
  'ZENDIKAR RISING': 'ZNR',
  'CORE SET 2021': 'M21',
  'IKORIA: LAIR OF BEHEMOTHS': 'IKO',
  'THEROS BEYOND DEATH': 'THB',
  
  // Commander Sets
  'COMMANDER MASTERS': 'CMM',
  'COMMANDER LEGENDS: BATTLE FOR BALDUR\'S GATE': 'CLB',
  'COMMANDER LEGENDS': 'CMR',
  'COMMANDER 2020': 'C20',
  'COMMANDER 2019': 'C19',
  'COMMANDER 2018': 'C18',
  'COMMANDER 2017': 'C17',
  'COMMANDER 2016': 'C16',
  'COMMANDER 2015': 'C15',
  'COMMANDER 2014': 'C14',
  'COMMANDER 2013': 'C13',
  
  // Masters Sets
  'ULTIMATE MASTERS': 'UMA',
  'MASTERS 25': 'A25',
  'ICONIC MASTERS': 'IMA',
  'MODERN MASTERS 2017': 'MM3',
  'MODERN MASTERS 2015': 'MM2',
  'MODERN MASTERS': 'MMA',
  
  // Special Sets
  'THE LORD OF THE RINGS: TALES OF MIDDLE-EARTH': 'LTR',
  'UNIVERSES BEYOND: WARHAMMER 40,000': '40K',
  'UNFINITY': 'UNF',
  'UNSTABLE': 'UST',
  'UNHINGED': 'UNH',
  'UNGLUED': 'UGL',
  
  // Core Sets
  'CORE SET 2020': 'M20',
  'CORE SET 2019': 'M19',
  'MAGIC 2015': 'M15',
  'MAGIC 2014': 'M14',
  'MAGIC 2013': 'M13',
  'MAGIC 2012': 'M12',
  'MAGIC 2011': 'M11',
  'MAGIC 2010': 'M10',
  
  // Historic Sets
  'TIME SPIRAL REMASTERED': 'TSR',
  'THRONE OF ELDRAINE': 'ELD',
  'WAR OF THE SPARK': 'WAR',
  'RAVNICA ALLEGIANCE': 'RNA',
  'GUILDS OF RAVNICA': 'GRN',
  'DOMINARIA': 'DOM',
  'RIVALS OF IXALAN': 'RIX',
  'IXALAN': 'XLN',
  'HOUR OF DEVASTATION': 'HOU',
  'AMONKHET': 'AKH',
  'AETHER REVOLT': 'AER',
  'KALADESH': 'KLD',
  'ELDRITCH MOON': 'EMN',
  'SHADOWS OVER INNISTRAD': 'SOI',
  'OATH OF THE GATEWATCH': 'OGW',
  'BATTLE FOR ZENDIKAR': 'BFZ',
  
  // Double Masters and Reprints
  'DOUBLE MASTERS 2022': '2X2',
  'DOUBLE MASTERS': '2XM',
  'MYSTERY BOOSTER': 'MB1',
  'JUMPSTART': 'JMP',
  
  // Pioneer and Modern
  'PIONEER MASTERS': 'PIO',
  'MODERN HORIZONS 3': 'MH3',
  'MODERN HORIZONS 2': 'MH2',
  'MODERN HORIZONS': 'MH1',
};

// Enhanced function to extract set codes from collection names
function extractSetCode(collection?: string): string | undefined {
  if (!collection) return undefined;
  
  const collectionUpper = collection.toUpperCase().trim();
  
  // Direct mapping check (most reliable)
  for (const [collectionName, setCode] of Object.entries(COLLECTION_TO_SET_MAP)) {
    if (collectionUpper === collectionName.toUpperCase() || 
        collectionUpper.includes(collectionName.toUpperCase())) {
      return setCode;
    }
  }
  
  // Fallback pattern matching for codes in parentheses or brackets
  const codePatterns = [
    /\b([A-Z]{3})\b/,        // Standard 3-letter codes
    /\b(C\d{2})\b/,          // Commander sets
    /\b([A-Z]{2}M)\b/,       // Masters sets  
    /\b(M\d{2})\b/,          // Core sets
    /\b(U[A-Z]{2})\b/,       // Un-sets
    /\b(\d{3})\b/,           // Three digit codes
    /\b([A-Z]\d{2})\b/,      // Letter + two digits
    /\(([A-Z0-9]{2,4})\)/,   // Codes in parentheses
    /\[([A-Z0-9]{2,4})\]/,   // Codes in brackets
  ];
  
  for (const pattern of codePatterns) {
    const match = collectionUpper.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return undefined;
}

// Search for cards by name (fuzzy matching)
export async function searchCardsByName(cardName: string): Promise<ScryfallCard[]> {
  const cacheKey = `search:${cardName.toLowerCase()}`;
  
  return getCached(cacheKey, async () => {
    try {
      const response = await rateLimitedRequest(() =>
        axios.get<ScryfallSearchResult>(`${SCRYFALL_API}/cards/search`, {
          params: {
            q: `!"${cardName}"`,
            order: 'released',
            dir: 'desc',
            unique: 'prints'
          }
        })
      );
      
      return response.data.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Try fuzzy search if exact match fails
        try {
          const fuzzyResponse = await rateLimitedRequest(() =>
            axios.get<ScryfallSearchResult>(`${SCRYFALL_API}/cards/search`, {
              params: {
                q: cardName,
                order: 'released',
                dir: 'desc',
                unique: 'prints'
              }
            })
          );
          return fuzzyResponse.data.data;
        } catch (fuzzyError) {
          console.log(`No cards found for: ${cardName}`);
          return [];
        }
      }
      console.error(`Error searching for ${cardName}:`, error);
      return [];
    }
  });
}

// Get card by exact name and set (for better matching) - This is what the modal uses!
export async function getCardByNameAndSet(cardName: string, setCode?: string): Promise<ScryfallCard | null> {
  const cacheKey = `card:${cardName.toLowerCase()}:${setCode || 'default'}`;
  
  return getCached(cacheKey, async () => {
    try {
      let query = `!"${cardName}"`;
      if (setCode) {
        query += ` set:${setCode}`;
      }
      
      const response = await rateLimitedRequest(() =>
        axios.get<ScryfallSearchResult>(`${SCRYFALL_API}/cards/search`, {
          params: {
            q: query,
            order: 'released',
            dir: 'desc'
          }
        })
      );
      
      return response.data.data[0] || null;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error(`Error fetching card ${cardName}:`, error);
      return null;
    }
  });
}

// Get all printings of a card
export async function getAllPrintings(cardName: string): Promise<ScryfallCard[]> {
  const cacheKey = `printings:${cardName.toLowerCase()}`;
  
  return getCached(cacheKey, async () => {
    try {
      const response = await rateLimitedRequest(() =>
        axios.get<ScryfallSearchResult>(`${SCRYFALL_API}/cards/search`, {
          params: {
            q: `!"${cardName}"`,
            order: 'released',
            dir: 'desc',
            unique: 'prints'
          }
        })
      );
      
      return response.data.data;
    } catch (error: any) {
      console.error(`Error fetching printings for ${cardName}:`, error);
      return [];
    }
  });
}

// Get EDHREC data for a card
export async function getEdhrecData(cardName: string): Promise<any> {
  const cacheKey = `edhrec:${cardName.toLowerCase()}`;
  
  return getCached(cacheKey, async () => {
    try {
      // Note: This would need EDHREC API integration or scraping
      // For now, we'll return the EDHREC URL from Scryfall data
      const card = await getCardByNameAndSet(cardName);
      return {
        url: card?.related_uris?.edhrec,
        rank: card?.edhrec_rank
      };
    } catch (error) {
      console.error(`Error fetching EDHREC data for ${cardName}:`, error);
      return null;
    }
  });
}

// Helper to get the best image URL for a card
export function getCardImageUrl(card: ScryfallCard, size: 'small' | 'normal' | 'large' = 'normal'): string {
  // Handle double-faced cards
  if (card.card_faces && card.card_faces.length > 0) {
    return card.card_faces[0].image_uris?.[size] || '';
  }
  
  return card.image_uris?.[size] || '';
}

// Helper to get thumbnail URL (optimized for grid display)
export function getCardThumbnail(card: ScryfallCard): string {
  return getCardImageUrl(card, 'small');
}

// Helper to get high-res image for modal
export function getCardHighRes(card: ScryfallCard): string {
  return getCardImageUrl(card, 'large');
}

// Helper to format mana cost with symbols
export function formatManaCost(manaCost: string): string {
  if (!manaCost) return '';
  
  // Replace mana symbols with readable text
  return manaCost
    .replace(/{([^}]+)}/g, '[$1]')
    .replace(/\//g, '/');
}

// Helper to get card rarity color
export function getRarityColor(rarity: string): string {
  switch (rarity.toLowerCase()) {
    case 'mythic': return '#FF8C42';
    case 'rare': return '#FFD700';
    case 'uncommon': return '#C0C0C0';
    case 'common': return '#000000';
    default: return '#666666';
  }
}

// Helper to check if we should fetch Scryfall data for a card
export function shouldFetchScryfallData(cardName: string): boolean {
  // Skip fetching for obviously non-Magic cards
  const skipPatterns = [
    'deckbox', 'sleeve', 'storage', 'binder', 'dice', 'counter',
    'playmat', 'pin', 'booster', 'pack', 'bundle', 'fatpack',
    'prerelease', 'promo pack', 'challenger deck', 'planeswalker deck'
  ];
  
  const lowerName = cardName.toLowerCase();
  return !skipPatterns.some(pattern => lowerName.includes(pattern)) && 
         cardName.length > 1 && 
         !cardName.match(/^_+$/);
}

// Simplified function: Use the same logic as the modal (works great!)
export async function getCardForThumbnail(cardName: string): Promise<ScryfallCard | null> {
  // Use the exact same logic as the modal - simple and reliable
  return getCardByNameAndSet(cardName);
}

// Enhanced card matching with multiple fallback strategies
export async function getCardMatchingAttributes(
  cardName: string, 
  foil: boolean, 
  rarity?: string, 
  collection?: string
): Promise<ScryfallCard | null> {
  const cacheKey = `enhanced:${cardName.toLowerCase()}:${foil}:${rarity}:${collection}`;
  
  return getCached(cacheKey, async () => {
    try {
      // Strategy 1: Try exact set matching first
      const setCode = extractSetCode(collection);
      if (setCode) {
        const exactMatch = await getCardByNameAndSet(cardName, setCode);
        if (exactMatch) {
          return exactMatch;
        }
      }
      
      // Strategy 2: Search with broader parameters if exact set fails
      const allPrintings = await getAllPrintings(cardName);
      if (allPrintings.length === 0) {
        return null;
      }
      
      // Strategy 3: Filter by rarity if provided
      let filteredCards = allPrintings;
      if (rarity) {
        const rarityFiltered = filteredCards.filter(card => 
          card.rarity.toLowerCase() === rarity.toLowerCase()
        );
        if (rarityFiltered.length > 0) {
          filteredCards = rarityFiltered;
        }
      }
      
      // Strategy 4: Prefer recent printings (last 3 years) for better image quality
      const recentDate = new Date();
      recentDate.setFullYear(recentDate.getFullYear() - 3);
      const recentCards = filteredCards.filter(card => 
        new Date(card.released_at) >= recentDate
      );
      
      if (recentCards.length > 0) {
        filteredCards = recentCards;
      }
      
      // Strategy 5: Prefer cards with pricing info that matches foil preference
      const pricingPreferredCards = filteredCards.filter(card => {
        if (foil) {
          return card.prices.eur_foil || card.prices.usd_foil;
        } else {
          return card.prices.eur || card.prices.usd;
        }
      });
      
      if (pricingPreferredCards.length > 0) {
        filteredCards = pricingPreferredCards;
      }
      
      // Strategy 6: Final selection - prefer cards with good image quality
      const cardsWithImages = filteredCards.filter(card => 
        card.image_uris?.small && card.image_uris?.normal
      );
      
      if (cardsWithImages.length > 0) {
        return cardsWithImages[0];
      }
      
      // Fallback: Return the first available card
      return filteredCards[0] || null;
      
    } catch (error: any) {
      console.warn(`Enhanced matching failed for ${cardName}, trying fallback:`, error.message);
      
      // Ultimate fallback: Simple name search
      try {
        const cards = await searchCardsByName(cardName);
        return cards[0] || null;
      } catch (fallbackError) {
        console.error(`All strategies failed for ${cardName}:`, fallbackError);
        return null;
      }
    }
  });
}

// New function: Get card with best image available
export async function getCardWithBestImage(cardName: string): Promise<ScryfallCard | null> {
  const cacheKey = `best-image:${cardName.toLowerCase()}`;
  
  return getCached(cacheKey, async () => {
    try {
      const allPrintings = await getAllPrintings(cardName);
      if (allPrintings.length === 0) {
        return null;
      }
      
      // Prioritize cards with high-quality images
      const cardsWithGoodImages = allPrintings.filter(card => 
        card.image_uris?.large && 
        card.image_uris?.normal && 
        card.image_uris?.small
      );
      
      if (cardsWithGoodImages.length === 0) {
        return allPrintings[0];
      }
      
      // Prefer recent sets for better image quality
      const recentDate = new Date();
      recentDate.setFullYear(recentDate.getFullYear() - 2);
      
      const recentCardsWithImages = cardsWithGoodImages.filter(card => 
        new Date(card.released_at) >= recentDate
      );
      
      return recentCardsWithImages[0] || cardsWithGoodImages[0];
      
    } catch (error) {
      console.error(`Error getting best image for ${cardName}:`, error);
      return null;
    }
  });
}

// Utility functions for cache management
export function clearImageCache() {
  // Check if we're in browser environment
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }
  
  try {
    localStorage.removeItem(PERSISTENT_CACHE_KEY);
    console.log('Image cache cleared');
  } catch (error) {
    console.warn('Failed to clear image cache:', error);
  }
}

export function getCacheStats() {
  // Check if we're in browser environment
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return {
      inMemoryCount: cache.size,
      persistentCount: 0,
      persistentSizeKB: 0
    };
  }
  
  const persistentCache = getPersistentCache();
  return {
    inMemoryCount: cache.size,
    persistentCount: persistentCache.size,
    persistentSizeKB: Math.round(JSON.stringify(Object.fromEntries(persistentCache)).length / 1024)
  };
} 