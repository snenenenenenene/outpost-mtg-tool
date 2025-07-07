import React, { useState } from 'react';
import { DeckAnalysis as DeckAnalysisType, CardAvailability } from '@/lib/types';
import { formatPrice } from '@/lib/utils';
import useStore from '@/lib/store';
import LoadingSpinner from './LoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { CheckCircleIcon, XCircleIcon, AlertCircleIcon, FileTextIcon, SparklesIcon } from 'lucide-react';

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

interface DeckAnalysisResultsProps {
  analysis: DeckAnalysisType;
}

function DeckAnalysisResults({ analysis }: DeckAnalysisResultsProps) {
  const totalCost = analysis.totalCost;
  const availabilityPercentage = Math.round((analysis.availableCards / analysis.totalCards) * 100);

  const getRarityDisplay = (rarity: string) => {
    switch (rarity) {
      case 'C': return 'Common';
      case 'U': return 'Uncommon';
      case 'R': return 'Rare';
      case 'M': return 'Mythic';
      default: return rarity;
    }
  };

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
                <p className="text-2xl font-bold">{analysis.totalCards}</p>
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
                <p className="text-2xl font-bold text-green-600">{analysis.availableCards}</p>
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
                <p className="text-2xl font-bold text-red-600">{analysis.missingCards}</p>
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

      {/* Cost Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">
              {formatPrice(totalCost)}
            </div>
            <p className="text-muted-foreground">
              Estimated total cost for available cards at Outpost Gaming Belgium
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Card Availability */}
      <Card>
        <CardHeader>
          <CardTitle>Card Availability</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {analysis.cardAvailability.map((card, index) => (
            <Card
              key={index}
              className={`${
                card.isFullyAvailable
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {card.isFullyAvailable ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircleIcon className="h-5 w-5 text-red-600" />
                    )}
                    <div>
                      <div className="font-medium text-foreground">{card.cardName}</div>
                      <div className="text-sm text-muted-foreground">
                        Need: {card.requestedQuantity} • Available: {card.totalAvailable}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-foreground">
                      {formatPrice(card.cheapestPrice)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {card.availableCards.length} listing{card.availableCards.length !== 1 ? 's' : ''}
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
    
    // Parse format: "1 Cayth, Famed Mechanist (M3C) 6 *F*"
    // or simpler: "1 Lightning Bolt"
    const match = trimmedLine.match(/^(\d+)\s+(.+?)(?:\s+\(([^)]+)\))?(?:\s+(\d+))?(?:\s+\*F\*)?$/);
    
    if (match) {
      const quantity = parseInt(match[1]);
      let cardName = match[2].trim();
      const setCode = match[3];
      const collectorNumber = match[4];
      const foil = trimmedLine.includes('*F*');
      
      // Clean up card name (remove any trailing set info that wasn't caught)
      cardName = cardName.replace(/\s+\([^)]+\)\s*\d*\s*\*?F?\*?$/, '').trim();
      
      cards.push({
        name: cardName,
        quantity,
        set: setCode,
        collectorNumber,
        foil
      });
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
          foil: card.foil || false
        };
      });

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
1 Cayth, Famed Mechanist (M3C) 6 *F*
1 Lightning Bolt
2 Island
1 Sol Ring *F*

Each line should have: quantity, card name, optional set info, optional *F* for foil`}
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
      {deckAnalysis && <DeckAnalysisResults analysis={deckAnalysis} />}

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
                <div><code className="text-xs">1 Cayth, Famed Mechanist (M3C) 6 *F*</code></div>
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
    </div>
  );
} 