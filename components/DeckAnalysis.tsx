import React, { useState, useEffect } from 'react';
import { DeckAnalysis as DeckAnalysisType, CardAvailability } from '@/lib/types';
import { formatPrice } from '@/lib/utils';
import useStore from '@/lib/store';
import LoadingSpinner from './LoadingSpinner';
import CardDetailModal from './CardDetailModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircleIcon, XCircleIcon, AlertCircleIcon, FileTextIcon, SparklesIcon, ImageIcon, ExternalLinkIcon, TrendingUpIcon, MapIcon, ArrowUpDownIcon } from 'lucide-react';
import { 
  ScryfallCard, 
  getCardForThumbnail, 
  getCardThumbnail, 
  getAllPrintings,
  getCardByNameAndSet,
  shouldFetchScryfallData
} from '@/lib/scryfall';

// Types for parsed deck list
interface DeckCard {
  name: string;
  quantity: number;
  set?: string;
  foil?: boolean;
  collectorNumber?: string;
}

interface ParsedDeck {
  name: string;
  format: string;
  cards: DeckCard[];
  totalCards: number;
}

// Enhanced card availability with Scryfall data
interface EnhancedCardAvailability extends CardAvailability {
  scryfallCard?: ScryfallCard;
  allPrintings?: ScryfallCard[];
  selectedPrinting?: ScryfallCard;
  marketPrice?: number;
  marketPriceFoil?: number;
  isBasicLand?: boolean;
  artMatched?: boolean; // New field to track if art matches original deck
}

// Sorting options
type SortOption = 'none' | 'availability' | 'markup' | 'outpost-price' | 'market-price' | 'name';

interface DeckAnalysisResultsProps {
  analysis: DeckAnalysisType;
  excludeBasicLands: boolean;
  aggressiveArtMatching: boolean;
  originalDeckCards: DeckCard[];
}

function DeckAnalysisResults({ analysis, excludeBasicLands, aggressiveArtMatching, originalDeckCards }: DeckAnalysisResultsProps) {
  const [enhancedCards, setEnhancedCards] = useState<EnhancedCardAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<ScryfallCard | null>(null);
  const [hoveredPosition, setHoveredPosition] = useState({ x: 0, y: 0 });
  const [sortBy, setSortBy] = useState<SortOption>('none');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Basic land types for filtering
  const BASIC_LAND_NAMES = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes'];

  // Helper function to check if art matches between cards
  const checkArtMatch = (scryfallCard: ScryfallCard, originalCard: DeckCard): boolean => {
    if (!originalCard.set || !originalCard.collectorNumber) return true; // Can't check, assume match
    
    return scryfallCard.set.toLowerCase() === originalCard.set.toLowerCase() && 
           scryfallCard.collector_number === originalCard.collectorNumber;
  };

  // Helper function to find best art-matching printing
  const findBestArtMatch = (allPrintings: ScryfallCard[], originalCard: DeckCard): ScryfallCard | null => {
    console.log(`🎨 Finding best art match for ${originalCard.name}:`, {
      originalSet: originalCard.set,
      originalCollectorNumber: originalCard.collectorNumber,
      availablePrintings: allPrintings.map(p => ({ set: p.set, collector_number: p.collector_number, set_name: p.set_name }))
    });

    if (!originalCard.set && !originalCard.collectorNumber) {
      console.log(`⚪ No set/collector info for ${originalCard.name}, using newest printing`);
      return allPrintings[0]; // Return newest printing if no specific art preference
    }

    // First try exact match on set and collector number
    const exactMatch = allPrintings.find(printing => 
      originalCard.set && printing.set.toLowerCase() === originalCard.set.toLowerCase() &&
      originalCard.collectorNumber && printing.collector_number === originalCard.collectorNumber
    );
    if (exactMatch) {
      console.log(`✅ Exact match found for ${originalCard.name}:`, { set: exactMatch.set, collector_number: exactMatch.collector_number });
      return exactMatch;
    }

    // Try set match only
    if (originalCard.set) {
      const setMatch = allPrintings.find(printing => 
        printing.set.toLowerCase() === originalCard.set!.toLowerCase()
      );
      if (setMatch) {
        console.log(`🔍 Set match found for ${originalCard.name}:`, { set: setMatch.set, collector_number: setMatch.collector_number });
        return setMatch;
      }
    }

    // Return newest printing as fallback
    console.log(`⚠️ No specific match for ${originalCard.name}, using fallback:`, { set: allPrintings[0].set, collector_number: allPrintings[0].collector_number });
    return allPrintings[0];
  };

  // Load Scryfall data for all cards
  useEffect(() => {
    const loadScryfallData = async () => {
      setLoading(true);
      
      const enhanced = await Promise.all(
        analysis.cardAvailability.map(async (card): Promise<EnhancedCardAvailability> => {
          const isBasicLand = BASIC_LAND_NAMES.includes(card.cardName);
          
          // Find original deck card for art matching
          const originalCard = originalDeckCards.find(dc => 
            dc.name.toLowerCase() === card.cardName.toLowerCase()
          );
          
          if (!shouldFetchScryfallData(card.cardName) || isBasicLand) {
            return { ...card, isBasicLand, artMatched: true };
          }

          try {
            // Get main Scryfall card data and all printings
            let scryfallCard = await getCardForThumbnail(card.cardName);
            let allPrintings: ScryfallCard[] = [];
            let artMatched = true;
            
            if (scryfallCard) {
              allPrintings = await getAllPrintings(card.cardName);
              
              // Try to find better art match if we have original card info
              if (originalCard && allPrintings.length > 1) {
                const bestMatch = findBestArtMatch(allPrintings, originalCard);
                if (bestMatch && bestMatch.id !== scryfallCard.id) {
                  scryfallCard = bestMatch;
                }
                artMatched = checkArtMatch(scryfallCard, originalCard);
              }
            }

            // For aggressive art matching, filter out available cards that don't match art
            let filteredAvailableCards = card.availableCards;
            if (aggressiveArtMatching && originalCard && scryfallCard) {
              filteredAvailableCards = card.availableCards.filter(availableCard => {
                if (!originalCard.set) return true; // Can't filter without set info
                
                // Check if the available card matches the original set
                const availableSet = availableCard.set || availableCard.collection;
                return !availableSet || !originalCard.set || availableSet.toLowerCase() === originalCard.set.toLowerCase();
              });
              
              // If no cards match art, mark as not fully available
              if (filteredAvailableCards.length === 0) {
                artMatched = false;
              }
            }

            // Determine market prices (prefer EUR, fallback to USD)
            let marketPrice = 0;
            let marketPriceFoil = 0;
            
            if (scryfallCard) {
              const eurPrice = parseFloat(scryfallCard.prices.eur || '0');
              const usdPrice = parseFloat(scryfallCard.prices.usd || '0');
              const eurFoilPrice = parseFloat(scryfallCard.prices.eur_foil || '0');
              const usdFoilPrice = parseFloat(scryfallCard.prices.usd_foil || '0');
              
              marketPrice = eurPrice || (usdPrice * 0.85); // rough EUR conversion
              marketPriceFoil = eurFoilPrice || (usdFoilPrice * 0.85);
            }

            // Update card availability if aggressive art matching filtered out cards
            const updatedCard = aggressiveArtMatching && filteredAvailableCards.length !== card.availableCards.length
              ? {
                  ...card,
                  availableCards: filteredAvailableCards,
                  totalAvailable: filteredAvailableCards.reduce((sum, ac) => 
                    sum + (ac.conditions?.reduce((condSum, cond) => condSum + cond.stock, 0) || 0), 0),
                  isFullyAvailable: filteredAvailableCards.reduce((sum, ac) => 
                    sum + (ac.conditions?.reduce((condSum, cond) => condSum + cond.stock, 0) || 0), 0) >= card.requestedQuantity,
                  cheapestPrice: filteredAvailableCards.length > 0 
                    ? Math.min(...filteredAvailableCards.flatMap(ac => 
                        ac.conditions?.filter(c => c.price > 0).map(c => c.price / 100) || [])) 
                    : 0
                }
              : card;

            return {
              ...updatedCard,
              scryfallCard: scryfallCard || undefined,
              allPrintings,
              selectedPrinting: scryfallCard || undefined,
              marketPrice,
              marketPriceFoil,
              isBasicLand,
              artMatched
            };
          } catch (error) {
            console.warn(`Failed to load Scryfall data for ${card.cardName}:`, error);
            return { ...card, isBasicLand, artMatched: true };
          }
        })
      );

      setEnhancedCards(enhanced);
      setLoading(false);
    };

    loadScryfallData();
  }, [analysis.cardAvailability, aggressiveArtMatching, originalDeckCards]);

  // Filter cards based on exclude basic lands setting
  const filteredCards = excludeBasicLands 
    ? enhancedCards.filter(card => !card.isBasicLand)
    : enhancedCards;

  // Sort cards based on selected criteria
  const sortedCards = React.useMemo(() => {
    if (sortBy === 'none') return filteredCards;

    const sorted = [...filteredCards].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'availability':
          // Sort by availability status, then by available quantity
          if (a.isFullyAvailable !== b.isFullyAvailable) {
            comparison = a.isFullyAvailable ? -1 : 1;
          } else {
            comparison = a.totalAvailable - b.totalAvailable;
          }
          break;

        case 'markup':
          // Sort by price difference (markup/savings)
          const aMarkup = a.marketPrice ? (a.cheapestPrice - a.marketPrice) : 0;
          const bMarkup = b.marketPrice ? (b.cheapestPrice - b.marketPrice) : 0;
          comparison = aMarkup - bMarkup;
          break;

        case 'outpost-price':
          comparison = a.cheapestPrice - b.cheapestPrice;
          break;

        case 'market-price':
          const aMarket = a.marketPrice || 0;
          const bMarket = b.marketPrice || 0;
          comparison = aMarket - bMarket;
          break;

        case 'name':
          comparison = a.cardName.localeCompare(b.cardName);
          break;

        default:
          comparison = 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [filteredCards, sortBy, sortDirection]);

  // Calculate totals
  const filteredAnalysis = {
    ...analysis,
    cardAvailability: sortedCards,
    totalCards: sortedCards.reduce((sum, card) => sum + card.requestedQuantity, 0),
    availableCards: sortedCards.filter(card => card.isFullyAvailable).length,
    missingCards: sortedCards.filter(card => !card.isFullyAvailable).length,
    totalCost: sortedCards.reduce((sum, card) => sum + card.cheapestPrice * card.requestedQuantity, 0)
  };

  // Calculate market value totals
  const marketValueTotal = sortedCards.reduce((sum, card) => {
    if (!card.marketPrice) return sum;
    const basePrice = card.marketPrice;
    const foilPrice = card.marketPriceFoil || card.marketPrice;
    
    // Use foil price if most available cards are foil, otherwise use non-foil
    const avgFoilRatio = card.availableCards.length > 0 
      ? card.availableCards.filter(c => c.foil).length / card.availableCards.length 
      : 0;
    
    const estimatedMarketPrice = avgFoilRatio > 0.5 ? foilPrice : basePrice;
    return sum + (estimatedMarketPrice * card.requestedQuantity);
  }, 0);

  const availabilityPercentage = filteredAnalysis.totalCards > 0 
    ? Math.round((filteredAnalysis.availableCards / filteredAnalysis.totalCards) * 100) 
    : 0;

  const getRarityDisplay = (rarity: string) => {
    switch (rarity) {
      case 'C': return 'Common';
      case 'U': return 'Uncommon';  
      case 'R': return 'Rare';
      case 'M': return 'Mythic';
      default: return rarity;
    }
  };

  const handleCardClick = (card: EnhancedCardAvailability) => {
    if (card.availableCards.length > 0) {
      setSelectedCard(card.availableCards[0]);
      setIsModalOpen(true);
    }
  };

  const handlePrintingSelect = (cardIndex: number, printing: ScryfallCard) => {
    setEnhancedCards(prev => prev.map((card, index) => 
      index === cardIndex 
        ? { ...card, selectedPrinting: printing }
        : card
    ));
  };

  const handlePrintingHover = (printing: ScryfallCard | null, event?: React.MouseEvent) => {
    setHoveredCard(printing);
    if (event && printing) {
      setHoveredPosition({ x: event.clientX, y: event.clientY });
    }
  };

  const handleSortChange = (newSortBy: SortOption) => {
    if (newSortBy === sortBy) {
      // Toggle direction if same sort option
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      // Default direction based on sort type
      setSortDirection(newSortBy === 'name' ? 'asc' : 'desc');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <LoadingSpinner />
          <p className="mt-4 text-muted-foreground">Loading card images and market data...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <FileTextIcon className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Cards</p>
                <p className="text-2xl font-bold">{filteredAnalysis.totalCards}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircleIcon className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Available</p>
                <p className="text-2xl font-bold text-green-600">{filteredAnalysis.availableCards}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <XCircleIcon className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Missing</p>
                <p className="text-2xl font-bold text-red-600">{filteredAnalysis.missingCards}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <SparklesIcon className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Availability</p>
                <p className="text-2xl font-bold text-yellow-600">{availabilityPercentage}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Cost Summary with Market Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUpIcon className="h-5 w-5" />
            Cost Summary & Market Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Outpost Total */}
            <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="text-sm font-medium text-green-700 mb-1">Outpost Gaming Belgium</div>
              <div className="text-3xl font-bold text-green-600 mb-2">
                {formatPrice(filteredAnalysis.totalCost)}
              </div>
              <p className="text-sm text-green-600">
                Total cost for available cards
              </p>
            </div>
            
            {/* Market Value Total */}
            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm font-medium text-blue-700 mb-1">Market Value (Scryfall)</div>
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {formatPrice(marketValueTotal)}
              </div>
              <p className="text-sm text-blue-600">
                Estimated market value
              </p>
            </div>
          </div>
          
          {/* Savings/Premium Indicator */}
          {marketValueTotal > 0 && (
            <div className="mt-4 text-center">
              {filteredAnalysis.totalCost < marketValueTotal ? (
                <div className="text-green-600 font-medium">
                  💰 Save {formatPrice(marketValueTotal - filteredAnalysis.totalCost)} vs market price
                </div>
              ) : (
                <div className="text-orange-600 font-medium">
                  📈 {formatPrice(filteredAnalysis.totalCost - marketValueTotal)} premium vs market price
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sorting Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUpDownIcon className="h-5 w-5" />
            Sort Cards
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={sortBy === 'none' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortBy('none')}
            >
              Default Order
            </Button>
            <Button
              variant={sortBy === 'availability' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSortChange('availability')}
            >
              Availability {sortBy === 'availability' && (sortDirection === 'asc' ? '↑' : '↓')}
            </Button>
            <Button
              variant={sortBy === 'markup' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSortChange('markup')}
            >
              Markup {sortBy === 'markup' && (sortDirection === 'asc' ? '↑' : '↓')}
            </Button>
            <Button
              variant={sortBy === 'outpost-price' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSortChange('outpost-price')}
            >
              Outpost Price {sortBy === 'outpost-price' && (sortDirection === 'asc' ? '↑' : '↓')}
            </Button>
            <Button
              variant={sortBy === 'market-price' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSortChange('market-price')}
            >
              Market Price {sortBy === 'market-price' && (sortDirection === 'asc' ? '↑' : '↓')}
            </Button>
            <Button
              variant={sortBy === 'name' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSortChange('name')}
            >
              Name {sortBy === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Click the same sort option again to reverse the order. 
            Markup shows price difference vs market value (negative = savings, positive = premium).
          </p>
        </CardContent>
      </Card>

      {/* Card Availability */}
      <Card>
        <CardHeader>
          <CardTitle>Card Availability</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredAnalysis.cardAvailability.map((card, index) => (
            <Card
              key={index}
              className={`${
                card.isFullyAvailable
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              } ${
                aggressiveArtMatching && !card.artMatched 
                  ? 'ring-2 ring-orange-300 bg-orange-50 border-orange-200'
                  : ''
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Card Image */}
                  <div className="flex-shrink-0">
                    {card.selectedPrinting ? (
                      <img
                        src={getCardThumbnail(card.selectedPrinting)}
                        alt={card.cardName}
                        className="w-20 h-28 object-cover rounded shadow-md"
                        onError={(e) => {
                          e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iMTEyIiB2aWV3Qm94PSIwIDAgODAgMTEyIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSI4MCIgaGVpZ2h0PSIxMTIiIGZpbGw9IiNmM2Y0ZjYiIHJ4PSI0Ii8+PGNpcmNsZSBjeD0iNDAiIGN5PSI1NiIgcj0iMTYiIGZpbGw9IiM5Y2EzYWYiLz48cGF0aCBkPSJtMzIgNDggOCAxNiA4LTE2eiIgZmlsbD0iIzljYTNhZiIvPjwvc3ZnPg==';
                        }}
                      />
                    ) : (
                      <div className="w-20 h-28 bg-gray-200 rounded shadow-md flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Card Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {card.isFullyAvailable ? (
                          <CheckCircleIcon className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                        ) : (
                          <XCircleIcon className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground">
                            <button
                              onClick={() => handleCardClick(card)}
                              className="hover:underline cursor-pointer text-left"
                            >
                              {card.cardName}
                            </button>
                            {aggressiveArtMatching && !card.artMatched && (
                              <Badge variant="outline" className="ml-2 text-orange-600 border-orange-300">
                                Art Mismatch
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Need: {card.requestedQuantity} • Available: {card.totalAvailable}
                          </div>
                          
                          {/* Copy Selection */}
                          {card.allPrintings && card.allPrintings.length > 1 && (
                            <div className="mt-2">
                              <Select
                                value={card.selectedPrinting?.id || ''}
                                onValueChange={(printingId) => {
                                  const printing = card.allPrintings?.find(p => p.id === printingId);
                                  if (printing) {
                                    handlePrintingSelect(index, printing);
                                  }
                                }}
                              >
                                <SelectTrigger className="w-full h-8 text-xs">
                                  <SelectValue placeholder="Select printing" />
                                </SelectTrigger>
                                <SelectContent>
                                  {card.allPrintings.map((printing) => (
                                    <SelectItem 
                                      key={printing.id} 
                                      value={printing.id}
                                      onMouseEnter={(e) => handlePrintingHover(printing, e)}
                                      onMouseLeave={() => handlePrintingHover(null)}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs">{printing.set.toUpperCase()}</span>
                                        <span>{printing.set_name}</span>
                                        <Badge variant="outline" className="text-xs">
                                          {printing.rarity}
                                        </Badge>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Pricing Section */}
                      <div className="text-right flex-shrink-0 ml-4">
                        {/* Outpost Price */}
                        <div className="mb-2">
                          <div className="text-sm font-medium text-green-700">Outpost</div>
                          <div className="font-bold text-green-600">
                            {formatPrice(card.cheapestPrice)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {card.availableCards.length} listing{card.availableCards.length !== 1 ? 's' : ''}
                          </div>
                        </div>

                        {/* Market Price */}
                        {card.marketPrice && (
                          <div>
                            <div className="text-sm font-medium text-blue-700">Market</div>
                            <div className="font-bold text-blue-600">
                              {formatPrice(card.marketPrice)}
                            </div>
                            {card.marketPriceFoil && card.marketPriceFoil !== card.marketPrice && (
                              <div className="text-xs text-blue-500">
                                Foil: {formatPrice(card.marketPriceFoil)}
                              </div>
                            )}
                            {/* Markup indicator */}
                            {card.cheapestPrice > 0 && (
                              <div className={`text-xs font-medium ${
                                card.cheapestPrice < card.marketPrice 
                                  ? 'text-green-600' 
                                  : 'text-orange-600'
                              }`}>
                                {card.cheapestPrice < card.marketPrice 
                                  ? `Save ${formatPrice(card.marketPrice - card.cheapestPrice)}`
                                  : `+${formatPrice(card.cheapestPrice - card.marketPrice)}`
                                }
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Available Cards List */}
                {card.availableCards.length > 0 && (
                  <div className="mt-3 pt-3">
                    <Separator />
                    <div className="text-xs text-muted-foreground mb-2 mt-3">Available copies:</div>
                    <div className="space-y-1">
                      {card.availableCards.slice(0, 3).map((availableCard, cardIndex) => {
                        const totalStock = availableCard.conditions?.reduce((sum, condition) => sum + condition.stock, 0) || 0;
                        const bestCondition = availableCard.conditions?.filter(c => c.price > 0 && c.stock > 0).sort((a, b) => {
                          // Sort by quality first (NM/M > EX/GD > SP/P > HP > PR), then by price
                          const qualityOrder = ['NM/M', 'EX/GD', 'SP/P', 'HP', 'PR'];
                          const aQuality = qualityOrder.indexOf(a.condition);
                          const bQuality = qualityOrder.indexOf(b.condition);
                          if (aQuality !== bQuality) return aQuality - bQuality;
                          return a.price - b.price;
                        })[0];
                        
                        return (
                          <div key={cardIndex} className="flex justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span>{availableCard.set || availableCard.collection}</span>
                              <Badge variant="secondary" className="text-xs">
                                {getRarityDisplay(availableCard.rarity)}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {availableCard.foil ? 'Foil' : 'Non-foil'}
                              </Badge>
                              <span className="text-muted-foreground">
                                Stock: {totalStock} • Best: {bestCondition?.condition || 'N/A'}
                              </span>
                            </div>
                            <span className="font-medium">
                              {bestCondition ? formatPrice(bestCondition.price / 100) : 'N/A'}
                            </span>
                          </div>
                        );
                      })}
                      {card.availableCards.length > 3 && (
                        <div className="text-xs text-muted-foreground">
                          +{card.availableCards.length - 3} more listings
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      {/* Card Detail Modal */}
      {selectedCard && (
        <CardDetailModal
          card={selectedCard}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      {/* Hover Image */}
      {hoveredCard && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: hoveredPosition.x + 10,
            top: hoveredPosition.y + 10,
          }}
        >
          <img
            src={getCardThumbnail(hoveredCard)}
            alt={hoveredCard.name}
            className="w-32 h-auto rounded shadow-lg"
          />
        </div>
      )}
    </div>
  );
}

// Parse deck list format
function parseDeckList(deckListText: string, deckName: string = 'Imported Deck'): ParsedDeck {
  const lines = deckListText.trim().split('\n');
  const cards: DeckCard[] = [];
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    // Skip comment lines
    if (trimmedLine.startsWith('//') || trimmedLine.startsWith('#')) continue;
    
    // Parse format: "10 Plains (LCI) 287 *F*"
    // or "1 Lightning Bolt (M21) 168"
    // or simpler: "1 Lightning Bolt"
    const match = trimmedLine.match(/^(\d+)\s+(.+?)(?:\s+\(([^)]+)\)(?:\s+(\d+))?)?(?:\s+\*F\*)?$/);
    
    if (match) {
      const quantity = parseInt(match[1]);
      let cardName = match[2].trim();
      const setCode = match[3]; // Set code from inside parentheses
      const collectorNumber = match[4]; // Collector number after parentheses
      const foil = trimmedLine.includes('*F*');
      
      // Clean up card name (remove any trailing set info that wasn't caught)
      cardName = cardName.replace(/\s+\([^)]+\)\s*\d*\s*\*?F?\*?$/, '').trim();
      
      const parsedCard = {
        name: cardName,
        quantity,
        set: setCode,
        collectorNumber,
        foil
      };
      
      console.log(`📝 Parsed deck card from "${trimmedLine}":`, parsedCard);
      cards.push(parsedCard);
    }
  }
  
  return {
    name: deckName,
    format: 'Unknown',
    cards,
    totalCards: cards.reduce((sum, card) => sum + card.quantity, 0)
  };
}

export default function DeckAnalysis() {
  const { deckAnalysis, currentDeck, analyzeDeck } = useStore();
  const [deckListText, setDeckListText] = useState('');
  const [deckName, setDeckName] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchCardStyle, setMatchCardStyle] = useState(false);
  const [excludeBasicLands, setExcludeBasicLands] = useState(false);
  const [aggressiveArtMatching, setAggressiveArtMatching] = useState(false);

  const handleAnalyzeDeck = async () => {
    if (!deckListText.trim()) {
      setError('Please enter a deck list');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      // Parse the deck list
      const parsedDeck = parseDeckList(deckListText, deckName || 'Imported Deck');
      
      if (parsedDeck.cards.length === 0) {
        throw new Error('No valid cards found in deck list');
      }

      // Convert to format expected by analyzeDeck
      const mockMoxfieldDeck = {
        id: 'imported-deck',
        name: parsedDeck.name,
        format: parsedDeck.format,
        mainboard: {} as any,
        sideboard: {} as any,
        maybeboard: {} as any,
        commanders: {} as any
      };

      // Add cards to mainboard
      parsedDeck.cards.forEach((card, index) => {
        mockMoxfieldDeck.mainboard[index] = {
          name: card.name,
          quantity: card.quantity,
          set: card.set,
          foil: false // MoxfieldCard doesn't have foil info, default to false
        };
      });

      // Store the parsed deck cards for art matching
      (mockMoxfieldDeck as any).originalParsedCards = parsedDeck.cards;

      analyzeDeck(mockMoxfieldDeck, matchCardStyle);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze deck');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClearDeck = () => {
    setDeckListText('');
    setDeckName('');
    setError(null);
  };

  return (
    <div className="space-y-8">
      {/* Deck Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileTextIcon className="h-5 w-5" />
            Import Deck List
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Deck Name (optional)</label>
            <Input
              type="text"
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              placeholder="Enter deck name (e.g., 'Cayth Artifacts')"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-2 block">Deck List</label>
            <Textarea
              value={deckListText}
              onChange={(e) => setDeckListText(e.target.value)}
              placeholder={`Paste your deck list here. Supported formats:
1 Alania (OTJ) 204 *F*
1 Lightning Bolt (M21) 168
2 Island
1 Sol Ring *F*

Each line should have: quantity, card name, optional (SET) collector_number, optional *F* for foil`}
              rows={12}
              className="font-mono text-sm"
            />
          </div>
          
          <div className="flex gap-3">
            <Button
              onClick={handleAnalyzeDeck}
              disabled={isAnalyzing || !deckListText.trim()}
              className="flex-1"
            >
              {isAnalyzing ? (
                <div className="flex items-center gap-2">
                  <LoadingSpinner size="sm" />
                  <span>Analyzing...</span>
                </div>
              ) : (
                'Analyze Deck'
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleClearDeck}
              disabled={isAnalyzing}
            >
              Clear
            </Button>
          </div>
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircleIcon className="h-5 w-5 text-red-600" />
              <span className="text-red-700">{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Deck Info */}
      {currentDeck && (
        <Card>
          <CardHeader>
            <CardTitle>Current Deck</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">{currentDeck.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {Object.keys(currentDeck.mainboard).length} cards
                </p>
              </div>
              <Badge variant="outline">
                Imported Deck
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analysis Results */}
      {deckAnalysis && <DeckAnalysisResults analysis={deckAnalysis} excludeBasicLands={excludeBasicLands} aggressiveArtMatching={aggressiveArtMatching} originalDeckCards={(currentDeck as any)?.originalParsedCards || []} />}

      {/* Empty State */}
      {!currentDeck && !deckAnalysis && (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-muted-foreground text-6xl mb-4">📋</div>
            <h3 className="text-lg font-medium mb-2">No Deck Analyzed Yet</h3>
            <p className="text-muted-foreground">
              Import a deck list above to analyze its availability at Outpost Gaming Belgium.
            </p>
            <div className="mt-4 text-sm text-muted-foreground">
              <div className="font-medium mb-2">Supported formats:</div>
              <div className="text-left inline-block space-y-1">
                <div><code className="text-xs">1 Lightning Bolt</code></div>
                <div><code className="text-xs">1 Alania (OTJ) 204 *F*</code></div>
                <div><code className="text-xs">4 Island</code></div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Match Card Style Toggle */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis Options</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="match-card-style"
              checked={!matchCardStyle}
              onChange={(e) => setMatchCardStyle(!e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="match-card-style" className="text-sm font-medium text-gray-700">
              Always use cheapest best quality (ignore set/foil preferences)
            </label>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            When checked, will prioritize card quality and price over matching specific sets or foil status.
            Automatically excludes all cards priced at €0.00.
          </p>
        </CardContent>
      </Card>

      {/* Exclude Basic Lands Toggle */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Lands</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-3">
            <Checkbox
              id="exclude-basic-lands"
              checked={excludeBasicLands}
              onCheckedChange={(checked) => setExcludeBasicLands(!!checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="exclude-basic-lands" className="text-sm font-medium text-gray-700">
              Exclude basic lands from availability and market value calculations
            </label>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Basic lands (Plains, Island, Swamp, Mountain, Forest, Wastes) are often available in large quantities and have low market value.
            Excluding them can give a more accurate representation of the market for other cards.
          </p>
        </CardContent>
      </Card>

      {/* Aggressive Art Matching Toggle */}
      <Card>
        <CardHeader>
          <CardTitle>Aggressive Art Matching</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-3">
            <Checkbox
              id="aggressive-art-matching"
              checked={aggressiveArtMatching}
              onCheckedChange={(checked) => setAggressiveArtMatching(!!checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="aggressive-art-matching" className="text-sm font-medium text-gray-700">
              Aggressively match card art to original deck (e.g., set and collector number)
            </label>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            When checked, will prioritize finding Scryfall cards that match the exact set and collector number of cards in your deck.
            This can help ensure you get the correct art for your deck.
          </p>
        </CardContent>
      </Card>

    </div>
  );
} 