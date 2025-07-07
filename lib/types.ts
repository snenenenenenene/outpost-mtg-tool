// Card condition/quality information
export interface CardCondition {
  condition: string; // NM/M, EX/GD, SP/P, HP, PR
  price: number; // in euro cents
  stock: number;
  priceFormatted: string;
  outpostId?: string; // Outpost's internal ID for this specific condition
}

// Card data from Outpost (updated to match actual scraped data with conditions)
export interface OutpostCard {
  name: string;
  alphabet: string;
  rarity: string; // M, R, U, C
  foil: boolean;
  colors: {
    white: boolean;
    blue: boolean;
    black: boolean;
    red: boolean;
    green: boolean;
    colorless: boolean;
  };
  collection: string;
  collectionId: string;
  set?: string;
  imageUrl?: string;
  detailUrl?: string;
  
  // Condition-specific data
  conditions: CardCondition[];
  
  // Computed properties for backwards compatibility
  price: number; // Price of cheapest available condition
  stock: number; // Total stock across all conditions
  priceFormatted: string; // Formatted price of cheapest available condition
}

// Scraped data response structure
export interface OutpostDataResponse {
  lastUpdated: string;
  totalCards: number;
  collectionsProcessed: number;
  cards: OutpostCard[];
}

// Moxfield deck structure
export interface MoxfieldCard {
  id: string;
  name: string;
  set: string;
  quantity: number;
  commanderQuantity?: number;
  sideboardQuantity?: number;
  maybeboardQuantity?: number;
}

export interface MoxfieldDeck {
  id: string;
  name: string;
  format: string;
  mainboard: Record<string, MoxfieldCard>;
  sideboard: Record<string, MoxfieldCard>;
  maybeboard: Record<string, MoxfieldCard>;
  commanders: Record<string, MoxfieldCard>;
}

// Card availability checking
export interface CardAvailability {
  cardName: string;
  requestedQuantity: number;
  availableCards: OutpostCard[];
  totalAvailable: number;
  cheapestPrice: number;
  averagePrice: number;
  isFullyAvailable: boolean;
}

// Deck analysis results
export interface DeckAnalysis {
  deckId: string;
  deckName: string;
  totalCards: number;
  availableCards: number;
  missingCards: number;
  totalCost: number;
  cardAvailability: CardAvailability[];
  lastAnalyzed: string;
}

// Shopping basket functionality
export interface BasketItem {
  card: OutpostCard;
  condition: CardCondition; // Specific condition being purchased
  quantity: number;
  addedAt: string;
  // Create a unique key for basket items since same card can exist in different collections/foil variants/conditions
  id: string; // Format: `${card.name}-${card.collection}-${card.foil}-${condition.condition}`
}

export interface BasketSummary {
  totalItems: number;
  totalQuantity: number;
  totalPrice: number; // in euro cents
  totalPriceFormatted: string;
  items: BasketItem[];
}

// Toast notifications
export interface ToastNotification {
  id: string;
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
}

// App state interface
export interface AppState {
  outpostData: OutpostCard[];
  isLoading: boolean;
  lastDataRefresh: string | null;
  currentDeck: MoxfieldDeck | null;
  deckAnalysis: DeckAnalysis | null;
  searchTerm: string;
  
  // Basket state
  basket: BasketItem[];
  isBasketOpen: boolean;
  
  // Toast state
  toasts: ToastNotification[];
  
  // Actions
  loadOutpostData: () => Promise<void>;
  setSearchTerm: (term: string) => void;
  analyzeDeck: (deck: MoxfieldDeck, matchCardStyle?: boolean) => void;
  clearDeck: () => void;
  refreshData: () => Promise<void>;
  
  // Basket actions
  addToBasket: (card: OutpostCard, condition: CardCondition, quantity?: number) => void;
  removeFromBasket: (itemId: string) => void;
  updateBasketQuantity: (itemId: string, quantity: number) => void;
  clearBasket: () => void;
  getBasketSummary: () => BasketSummary;
  toggleBasket: () => void;
  
  // Toast actions
  addToast: (message: string, type?: 'success' | 'error' | 'info', duration?: number) => void;
  removeToast: (id: string) => void;
} 