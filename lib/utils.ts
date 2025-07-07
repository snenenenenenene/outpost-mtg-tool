import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { OutpostCard, MoxfieldDeck } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format price in euros
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

// Format date for display
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Parse Moxfield deck URL to extract deck ID
export function parseMoxfieldUrl(url: string): string | null {
  // Match both formats: /decks/deckId and /decks/username/deckId
  const match = url.match(/moxfield\.com\/decks\/(?:[^/]+\/)?([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

// Fetch deck data from Moxfield API
export async function fetchMoxfieldDeck(deckId: string): Promise<MoxfieldDeck> {
  const response = await fetch(`https://api2.moxfield.com/v3/decks/all/${deckId}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch deck: ${response.status}`);
  }

  return response.json();
}

// Enhanced search function for cards
export function searchCards(cards: OutpostCard[], searchTerm: string): OutpostCard[] {
  if (!searchTerm) return cards;

  // Check for @ syntax for set/collection searching
  if (searchTerm.startsWith('@')) {
    const setQuery = searchTerm.slice(1).toLowerCase();
    return cards.filter(card => {
      const collection = card.collection?.toLowerCase() || '';
      const set = card.set?.toLowerCase() || '';
      return collection.includes(setQuery) || set.includes(setQuery);
    });
  }

  // Regular text search across card name, collection, and set
  const query = searchTerm.toLowerCase();
  return cards.filter(card => {
    const name = card.name?.toLowerCase() || '';
    const collection = card.collection?.toLowerCase() || '';
    const set = card.set?.toLowerCase() || '';
    
    return name.includes(query) || 
           collection.includes(query) || 
           set.includes(query);
  });
}
