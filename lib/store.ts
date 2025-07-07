import { create } from 'zustand';
import { AppState, OutpostCard, MoxfieldDeck, DeckAnalysis, CardAvailability, OutpostDataResponse, BasketItem, BasketSummary, ToastNotification, CardCondition } from './types';
import { formatPrice } from './utils';

const useStore = create<AppState>((set: any, get: any) => ({
  outpostData: [],
  isLoading: false,
  lastDataRefresh: null,
  currentDeck: null,
  deckAnalysis: null,
  searchTerm: '',
  
  // Basket state
  basket: [],
  isBasketOpen: false,
  
  // Toast state
  toasts: [],

  loadOutpostData: async () => {
    set({ isLoading: true });
    try {
      const response = await fetch('/outpost-stock.json');
      const data: any = await response.json(); // Use any since the JSON structure might be old format
      
      // Extract cards array from the response structure
      const rawCards = data.cards || [];
      
      // Convert old format to new format if needed
      const cards: OutpostCard[] = rawCards.map((card: any) => {
        // If card already has conditions array, use it as-is
        if (card.conditions && Array.isArray(card.conditions)) {
          return card as OutpostCard;
        }
        
        // Convert old format (direct price/stock) to new format (conditions array)
        const condition: CardCondition = {
          condition: 'NM/M', // Default condition for old format
          price: card.price || 0,
          stock: card.stock || 0,
          priceFormatted: card.priceFormatted || formatPrice((card.price || 0) / 100)
        };
        
        return {
          ...card,
          conditions: [condition],
          // Keep backwards compatibility fields
          price: card.price || 0,
          stock: card.stock || 0,
          priceFormatted: card.priceFormatted || formatPrice((card.price || 0) / 100)
        } as OutpostCard;
      });
      
      set({ 
        outpostData: cards, 
        isLoading: false, 
        lastDataRefresh: data.lastUpdated || new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to load Outpost data:', error);
      set({ isLoading: false });
    }
  },

  setSearchTerm: (term: string) => {
    set({ searchTerm: term });
  },

  analyzeDeck: (deck: MoxfieldDeck, matchCardStyle: boolean = false) => {
    const { outpostData } = get();
    
    const allCards = [
      ...Object.values(deck.mainboard),
      ...Object.values(deck.sideboard),
      ...Object.values(deck.maybeboard),
      ...Object.values(deck.commanders),
    ];

    const cardAvailability: CardAvailability[] = allCards.map(card => {
      // Step 1: Try exact name match first (most accurate)
      let availableCards = outpostData.filter((outpostCard: OutpostCard) => 
        outpostCard.name.toLowerCase() === card.name.toLowerCase()
      );
      
      // Step 2: If no exact match, try exact substring match (card name contains search term)
      if (availableCards.length === 0) {
        availableCards = outpostData.filter((outpostCard: OutpostCard) => 
          outpostCard.name.toLowerCase().includes(card.name.toLowerCase())
        );
      }
      
      // Step 3: Only as last resort, try bidirectional fuzzy matching
      if (availableCards.length === 0) {
        availableCards = outpostData.filter((outpostCard: OutpostCard) => 
          card.name.toLowerCase().includes(outpostCard.name.toLowerCase())
        );
      }
      
      // Auto-exclude cards with zero prices
      availableCards = availableCards.filter((outpostCard: OutpostCard) => {
        const hasValidPrice = outpostCard.conditions?.some(condition => condition.price > 0) || false;
        return hasValidPrice;
      });

      // If matchCardStyle is enabled, prioritize cards that match set and foil preferences
      if (matchCardStyle) {
        const matchingCards = availableCards.filter((outpostCard: OutpostCard) => {
          const setMatches = !card.set || !outpostCard.set || 
            outpostCard.set.toLowerCase().includes(card.set.toLowerCase()) ||
            card.set.toLowerCase().includes(outpostCard.set.toLowerCase());
          // Note: MoxfieldCard doesn't have foil property, so we skip foil matching for now
          const foilMatches = true; // Skip foil matching until we have proper type support
          return setMatches && foilMatches;
        });
        
        // Use matching cards if found, otherwise fall back to all available cards
        if (matchingCards.length > 0) {
          availableCards = matchingCards;
        }
      }

      // Calculate total available stock from all conditions (only non-zero price conditions)
      const totalAvailable = availableCards.reduce((sum: number, card: OutpostCard) => {
        return sum + (card.conditions?.reduce((condSum, condition) => 
          condition.price > 0 ? condSum + condition.stock : condSum, 0) || 0);
      }, 0);
      
      // Get the best quality card at the cheapest price
      // Quality hierarchy: NM/M > EX/GD > SP/P > HP > PR
      const qualityOrder = ['NM/M', 'EX/GD', 'SP/P', 'HP', 'PR'];
      
      let bestPrice = 0;
      let bestCard = null;
      let bestCondition = null;
      
      for (const quality of qualityOrder) {
        const candidateCards = availableCards.flatMap((card: OutpostCard) => 
          card.conditions?.filter(condition => 
            condition.condition === quality && 
            condition.price > 0 && 
            condition.stock > 0
          ).map(condition => ({ card, condition })) || []
        );
        
        if (candidateCards.length > 0) {
          // Find cheapest price within this quality tier
          const cheapestInTier = candidateCards.reduce((best: any, current: any) => 
            current.condition.price < best.condition.price ? current : best
          );
          
          bestPrice = cheapestInTier.condition.price / 100;
          bestCard = cheapestInTier.card;
          bestCondition = cheapestInTier.condition;
          break;
        }
      }
      
      // If no stock available, find cheapest price regardless of stock
      if (bestPrice === 0) {
        for (const quality of qualityOrder) {
          const candidateCards = availableCards.flatMap((card: OutpostCard) => 
            card.conditions?.filter(condition => 
              condition.condition === quality && 
              condition.price > 0
            ).map(condition => ({ card, condition })) || []
          );
          
          if (candidateCards.length > 0) {
            const cheapestInTier = candidateCards.reduce((best: any, current: any) => 
              current.condition.price < best.condition.price ? current : best
            );
            
            bestPrice = cheapestInTier.condition.price / 100;
            bestCard = cheapestInTier.card;
            bestCondition = cheapestInTier.condition;
            break;
          }
        }
      }

      // Calculate average price for reference (only from non-zero prices)
      const validPrices = availableCards.flatMap((card: OutpostCard) => 
        card.conditions?.filter(condition => condition.price > 0).map(condition => condition.price / 100) || []
      );
      const averagePrice = validPrices.length > 0 ? validPrices.reduce((sum: number, price: number) => sum + price, 0) / validPrices.length : 0;

      return {
        cardName: card.name,
        requestedQuantity: card.quantity,
        availableCards,
        totalAvailable,
        cheapestPrice: bestPrice,
        averagePrice,
        isFullyAvailable: totalAvailable >= card.quantity,
      };
    });

    const analysis: DeckAnalysis = {
      deckId: deck.id,
      deckName: deck.name,
      totalCards: allCards.length,
      availableCards: cardAvailability.filter(card => card.isFullyAvailable).length,
      missingCards: cardAvailability.filter(card => !card.isFullyAvailable).length,
      totalCost: cardAvailability.reduce((sum, card) => sum + (card.cheapestPrice * card.requestedQuantity), 0),
      cardAvailability,
      lastAnalyzed: new Date().toISOString(),
    };

    set({ currentDeck: deck, deckAnalysis: analysis });
  },

  clearDeck: () => {
    set({ currentDeck: null, deckAnalysis: null });
  },

  refreshData: async () => {
    const { loadOutpostData } = get();
    await loadOutpostData();
  },

  // Basket actions
  addToBasket: (card: OutpostCard, condition: CardCondition, quantity = 1) => {
    const { basket, addToast } = get();
    const itemId = `${card.name}-${card.collection}-${card.foil}-${condition.condition}`;
    
    // Check if item already exists in basket
    const existingItemIndex = basket.findIndex((item: BasketItem) => item.id === itemId);
    
    if (existingItemIndex !== -1) {
      // Update existing item quantity (but don't exceed available stock for this condition)
      const existingItem = basket[existingItemIndex];
      const newQuantity = Math.min(existingItem.quantity + quantity, condition.stock);
      
      if (newQuantity > existingItem.quantity) {
        const updatedBasket = [...basket];
        updatedBasket[existingItemIndex] = {
          ...existingItem,
          quantity: newQuantity
        };
        
        set({ basket: updatedBasket });
        addToast(`Updated ${card.name} (${condition.condition}) quantity in cart`, 'success');
      } else {
        addToast(`Cannot add more ${card.name} (${condition.condition}) - stock limit reached`, 'error');
      }
    } else {
      // Add new item to basket (but don't exceed available stock for this condition)
      const actualQuantity = Math.min(quantity, condition.stock);
      
      if (actualQuantity > 0) {
        const newItem: BasketItem = {
          card,
          condition,
          quantity: actualQuantity,
          addedAt: new Date().toISOString(),
          id: itemId
        };
        
        set({ basket: [...basket, newItem] });
        addToast(`Added ${card.name} (${condition.condition}) to cart`, 'success');
      } else {
        addToast(`Cannot add ${card.name} (${condition.condition}) - out of stock`, 'error');
      }
    }
  },

  removeFromBasket: (itemId: string) => {
    const { basket } = get();
    const updatedBasket = basket.filter((item: BasketItem) => item.id !== itemId);
    set({ basket: updatedBasket });
  },

  updateBasketQuantity: (itemId: string, quantity: number) => {
    const { basket } = get();
    const itemIndex = basket.findIndex((item: BasketItem) => item.id === itemId);
    
    if (itemIndex !== -1) {
      const updatedBasket = [...basket];
      const item = updatedBasket[itemIndex];
      
      // Ensure quantity doesn't exceed available stock for this specific condition
      const newQuantity = Math.min(Math.max(quantity, 0), item.condition.stock);
      
      if (newQuantity === 0) {
        // Remove item if quantity is 0
        updatedBasket.splice(itemIndex, 1);
      } else {
        updatedBasket[itemIndex] = {
          ...item,
          quantity: newQuantity
        };
      }
      
      set({ basket: updatedBasket });
    }
  },

  clearBasket: () => {
    set({ basket: [] });
  },

  getBasketSummary: (): BasketSummary => {
    const { basket } = get();
    
    const totalItems = basket.length;
    const totalQuantity = basket.reduce((sum: number, item: BasketItem) => sum + item.quantity, 0);
    const totalPrice = basket.reduce((sum: number, item: BasketItem) => sum + (item.condition.price * item.quantity), 0);
    
    return {
      totalItems,
      totalQuantity,
      totalPrice,
      totalPriceFormatted: formatPrice(totalPrice / 100),
      items: basket
    };
  },

  toggleBasket: () => {
    const { isBasketOpen } = get();
    set({ isBasketOpen: !isBasketOpen });
  },

  // Toast actions
  addToast: (message: string, type: 'success' | 'error' | 'info' = 'success', duration = 3000) => {
    const { toasts } = get();
    const newToast: ToastNotification = {
      id: Date.now().toString(),
      message,
      type,
      duration
    };
    set({ toasts: [...toasts, newToast] });
  },

  removeToast: (id: string) => {
    const { toasts } = get();
    const updatedToasts = toasts.filter((toast: ToastNotification) => toast.id !== id);
    set({ toasts: updatedToasts });
  },
}));

export default useStore; 