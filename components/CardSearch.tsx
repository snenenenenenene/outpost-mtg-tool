import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import useStore from '@/lib/store';
import { OutpostCard, CardCondition } from '@/lib/types';
import { formatPrice, searchCards } from '@/lib/utils';
import { 
  getCardForThumbnail, 
  getCardThumbnail, 
  shouldFetchScryfallData, 
  clearImageCache, 
  getCacheStats 
} from '@/lib/scryfall';
import CardDetailModal from './CardDetailModal';
import LoadingSpinner from './LoadingSpinner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  GridIcon, 
  ListIcon, 
  FilterIcon, 
  SearchIcon, 
  SortAscIcon, 
  SortDescIcon,
  ShoppingCartIcon,
  ImageIcon,
  PackageIcon,
  TagIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XIcon,
  PlusIcon,
  RefreshCwIcon,
  DatabaseIcon,
  SparklesIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { FixedSizeList as List } from 'react-window';

// Mana color icons mapping
const ManaIcon = ({ color, size = 16 }: { color: string; size?: number }) => {
  const iconMap: Record<string, string> = {
    'W': '/icons/w.svg',
    'U': '/icons/u.svg',
    'B': '/icons/b.svg',
    'R': '/icons/r.svg',
    'G': '/icons/g.svg',
  };

  const iconPath = iconMap[color.toUpperCase()];
  if (!iconPath) return null;

  return (
    <img
      src={iconPath}
      alt={color}
      width={size}
      height={size}
      className="inline-block"
    />
  );
};

// Extract colors from card colors object
const getCardColors = (colors: OutpostCard['colors']): string[] => {
  const activeColors: string[] = [];
  
  if (colors.white) activeColors.push('W');
  if (colors.blue) activeColors.push('U');
  if (colors.black) activeColors.push('B');
  if (colors.red) activeColors.push('R');
  if (colors.green) activeColors.push('G');
  
  return activeColors;
};

// Enhanced debounced search hook with faster response
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Search suggestion types
interface SearchSuggestion {
  type: 'card' | 'collection' | 'set';
  value: string;
  label: string;
  count?: number;
  extra?: string;
}

// Enhanced Search Input Component with Autocomplete
interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: SearchSuggestion[];
  placeholder?: string;
}

const SearchInput = ({ value, onChange, suggestions, placeholder }: SearchInputProps) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setShowSuggestions(newValue.length > 0);
    setSelectedIndex(-1);
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    onChange(suggestion.value);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSuggestionClick(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current && 
        !inputRef.current.contains(event.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'card': return '🃏';
      case 'collection': return '📦';
      case 'set': return '🔍';
      default: return '📄';
    }
  };

  const getSuggestionLabel = (suggestion: SearchSuggestion) => {
    switch (suggestion.type) {
      case 'card':
        return `${suggestion.label}`;
      case 'collection':
        return `Collection: ${suggestion.label}`;
      case 'set':
        return `Set: ${suggestion.label}`;
      default:
        return suggestion.label;
    }
  };

  return (
    <div className="relative flex-1 max-w-xl">
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => value.length > 0 && setShowSuggestions(true)}
          placeholder={placeholder || "Search cards... Use @bloom for Bloomburrow sets"}
          className="pl-10"
        />
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div 
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-hidden"
        >
          <ScrollArea className="max-h-64">
            <div className="py-1">
              {suggestions.slice(0, 8).map((suggestion, index) => (
                <div
                  key={`${suggestion.type}-${suggestion.value}`}
                  className={`px-3 py-2 cursor-pointer flex items-center justify-between hover:bg-gray-100 ${
                    index === selectedIndex ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                  }`}
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-sm">{getSuggestionIcon(suggestion.type)}</span>
                    <span className="text-sm truncate">
                      {getSuggestionLabel(suggestion)}
                    </span>
                    {suggestion.extra && (
                      <span className="text-xs text-muted-foreground">
                        {suggestion.extra}
                      </span>
                    )}
                  </div>
                  {suggestion.count && (
                    <Badge variant="secondary" className="text-xs ml-2">
                      {suggestion.count}
                    </Badge>
                  )}
                </div>
              ))}
              {suggestions.length > 8 && (
                <div className="px-3 py-1 text-xs text-muted-foreground text-center">
                  +{suggestions.length - 8} more results...
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
      
      <div className="mt-1 text-xs text-muted-foreground">
        💡 Use @ to search sets: "@bloom alania" finds Alania cards in Bloomburrow
      </div>
    </div>
  );
};

// Skeleton loader component
const ImageSkeleton = () => (
  <Skeleton className="w-full h-64 rounded-lg" />
);

// Enhanced Card grid item component with hover cart icon
interface CardItemProps {
  card: OutpostCard;
  onCardClick: (card: OutpostCard) => void;
  cardThumbnails: Map<string, string>;
}

const CardItem = ({ card, onCardClick, cardThumbnails }: CardItemProps) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [selectedCondition, setSelectedCondition] = useState<string>('');
  const [isHovered, setIsHovered] = useState(false);
  const { addToBasket } = useStore();

  const thumbnailUrl = cardThumbnails.get(card.name);
  const availableConditions = card.conditions?.filter(c => c.stock > 0) || [];
  const hasStock = availableConditions.length > 0;

  // Reset states when thumbnail URL changes
  useEffect(() => {
    if (thumbnailUrl) {
      setImageLoading(true);
      setImageError(false);
      setRetryCount(0);
    }
  }, [thumbnailUrl]);

  // Default to best available condition (lowest price)
  useEffect(() => {
    if (availableConditions.length > 0 && !selectedCondition) {
      const bestCondition = availableConditions.sort((a, b) => a.price - b.price)[0];
      setSelectedCondition(bestCondition.condition);
    }
  }, [availableConditions, selectedCondition]);

  const currentCondition = availableConditions.find(c => c.condition === selectedCondition) || availableConditions[0];
  const minPrice = (card.conditions && card.conditions.length > 0) 
    ? Math.min(...card.conditions.map(c => c.price)) 
    : 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentCondition) {
      addToBasket(card, currentCondition, 1);
      toast.success(`Added ${card.name} to cart`);
    } else {
      toast.error('No available stock for this card');
    }
  };

  return (
    <Card 
      className="group cursor-pointer hover:shadow-lg transition-all duration-200 overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent className="p-0">
        <div className="relative">
          {/* Card Image */}
          <div 
            className="relative overflow-hidden"
            onClick={() => onCardClick(card)}
          >
            {thumbnailUrl && !imageError ? (
              <>
                {imageLoading && <ImageSkeleton />}
                <img
                  src={thumbnailUrl}
                  alt={card.name}
                  className={`w-full h-64 object-cover transition-all duration-200 ${
                    imageLoading ? 'opacity-0 absolute inset-0' : 'opacity-100'
                  } ${isHovered ? 'scale-105' : 'scale-100'}`}
                  onLoad={() => {
                    setImageLoading(false);
                    setImageError(false);
                  }}
                  onError={() => {
                    if (retryCount < 2) {
                      // Retry loading the image up to 2 times
                      setRetryCount(prev => prev + 1);
                      setTimeout(() => {
                        setImageLoading(true);
                        setImageError(false);
                      }, 1000 * (retryCount + 1));
                    } else {
                      setImageError(true);
                      setImageLoading(false);
                    }
                  }}
                  loading="lazy"
                />
              </>
            ) : (
              <div className="w-full h-64 bg-muted flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <ImageIcon className="h-12 w-12 mb-2 mx-auto" />
                  <div className="text-sm">No Image</div>
                </div>
              </div>
            )}
            
            {/* Foil Badge */}
            {card.foil && (
              <Badge className="absolute top-2 left-2 bg-yellow-500 text-yellow-950 shadow-lg">
                ✨ Foil
              </Badge>
            )}

            {/* Hover Add to Cart Button */}
            {isHovered && hasStock && (
              <Button
                size="sm"
                onClick={handleAddToCart}
                className="absolute top-2 right-2 h-8 w-8 p-0 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 transition-all duration-200 scale-110"
              >
                <PlusIcon className="h-4 w-4" />
              </Button>
            )}

            {/* Out of Stock Overlay */}
            {!hasStock && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Badge variant="destructive" className="text-sm">
                  Out of Stock
                </Badge>
              </div>
            )}
          </div>

          {/* Card Details */}
          <div className="p-4 space-y-3">
            <div>
              <h3 
                className="font-semibold text-sm leading-tight line-clamp-2 cursor-pointer hover:text-blue-600 transition-colors mb-1"
                onClick={() => onCardClick(card)}
              >
                {card.name}
              </h3>
              
              <div className="flex items-center gap-1 flex-wrap">
                <Badge variant="outline" className="text-xs truncate max-w-32">
                  {card.collection}
                </Badge>
                {/* Mana Color Icons */}
                <div className="flex items-center gap-1 ml-1">
                  {getCardColors(card.colors).map((color: string, index: number) => (
                    <ManaIcon key={index} color={color} size={14} />
                  ))}
                </div>
              </div>
            </div>

            {/* Condition Selector */}
            {hasStock && availableConditions.length > 1 && (
              <Select value={selectedCondition} onValueChange={setSelectedCondition}>
                <SelectTrigger className="w-full h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableConditions.map((condition) => (
                    <SelectItem key={condition.condition} value={condition.condition}>
                      {condition.condition} - {formatPrice(condition.price / 100)} ({condition.stock} left)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-lg text-green-600">
                  {currentCondition ? formatPrice(currentCondition.price / 100) : formatPrice(minPrice / 100)}
                </div>
                {currentCondition && (
                  <div className="text-xs text-muted-foreground">
                    {currentCondition.condition}
                  </div>
                )}
              </div>
              <div className="text-xs text-muted-foreground text-right">
                <div className="font-medium">
                  {(card.conditions && card.conditions.length > 0) 
                    ? card.conditions.reduce((sum, c) => sum + c.stock, 0) 
                    : 0} in stock
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// List item component  
interface ListItemProps {
  card: OutpostCard;
  onCardClick: (card: OutpostCard) => void;
  cardThumbnails: Map<string, string>;
}

const ListItem = ({ card, onCardClick, cardThumbnails }: ListItemProps) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const { addToBasket } = useStore();

  const thumbnailUrl = cardThumbnails.get(card.name);
  const availableConditions = card.conditions?.filter(c => c.stock > 0) || [];
  const hasStock = availableConditions.length > 0;
  const bestCondition = availableConditions.sort((a, b) => a.price - b.price)[0];
  const minPrice = (card.conditions && card.conditions.length > 0) 
    ? Math.min(...card.conditions.map(c => c.price)) 
    : 0;

  // Reset states when thumbnail URL changes
  useEffect(() => {
    if (thumbnailUrl) {
      setImageLoading(true);
      setImageError(false);
      setRetryCount(0);
    }
  }, [thumbnailUrl]);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (bestCondition) {
      addToBasket(card, bestCondition, 1);
      toast.success(`Added ${card.name} to cart`);
    } else {
      toast.error('No available stock for this card');
    }
  };

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => onCardClick(card)}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-16 h-16">
            {thumbnailUrl && !imageError ? (
              <>
                {imageLoading && <Skeleton className="w-16 h-16 rounded" />}
                <img
                  src={thumbnailUrl}
                  alt={card.name}
                  className={`w-16 h-16 object-cover rounded transition-opacity ${
                    imageLoading ? 'opacity-0 absolute' : 'opacity-100'
                  }`}
                  onLoad={() => {
                    setImageLoading(false);
                    setImageError(false);
                  }}
                  onError={() => {
                    if (retryCount < 2) {
                      setRetryCount(prev => prev + 1);
                      setTimeout(() => {
                        setImageLoading(true);
                        setImageError(false);
                      }, 1000 * (retryCount + 1));
                    } else {
                      setImageError(true);
                      setImageLoading(false);
                    }
                  }}
                  loading="lazy"
                />
              </>
            ) : (
              <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{card.name}</h3>
            <p className="text-sm text-muted-foreground truncate">
              {card.collection}
            </p>
            
            <div className="flex items-center gap-2 mt-1">
              {card.foil && (
                <Badge variant="outline" className="text-xs">
                  ✨ Foil
                </Badge>
              )}
              {/* Mana Color Icons */}
              <div className="flex items-center gap-1">
                {getCardColors(card.colors).map((color: string, index: number) => (
                  <ManaIcon key={index} color={color} size={14} />
                ))}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="font-semibold text-lg text-green-600">
                {formatPrice(minPrice / 100)}
              </div>
              <div className="text-xs text-muted-foreground">
                {availableConditions.length} condition{availableConditions.length !== 1 ? 's' : ''} • {(card.conditions && card.conditions.length > 0) 
                  ? card.conditions.reduce((sum, c) => sum + c.stock, 0) 
                  : 0} total stock
              </div>
            </div>
            
            <Button
              size="sm"
              onClick={handleAddToCart}
              disabled={!hasStock}
            >
              <ShoppingCartIcon className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Integrated filters component
interface FiltersProps {
  filters: {
    availableOnly: boolean;
    foilOnly: boolean;
    rarities: string[];
    priceRange: [number, number];
    collections: string[];
    conditions: string[];
  };
  onFiltersChange: (filters: any) => void;
  availableCollections: string[];
  totalCards: number;
  filteredCards: number;
}

const IntegratedFilters = ({ filters, onFiltersChange, availableCollections, totalCards, filteredCards }: FiltersProps) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const availableRarities = ['Common', 'Uncommon', 'Rare', 'Mythic'];
  const availableConditions = ['NM/M', 'EX/GD', 'SP/P', 'HP', 'PR'];

  const activeFiltersCount = [
    filters.availableOnly,
    filters.foilOnly,
    filters.collections.length > 0,
    filters.conditions.length > 0
  ].filter(Boolean).length;

  const clearFilters = () => {
    onFiltersChange({
      availableOnly: false,
      foilOnly: false,
      rarities: [],
      priceRange: [0, 1000],
      collections: [],
      conditions: []
    });
  };

  return (
    <div className="space-y-4">
      {/* Quick Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <FilterIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Quick Filters:</span>
        </div>
        
        <Button
          variant={filters.availableOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => onFiltersChange({ ...filters, availableOnly: !filters.availableOnly })}
        >
          <PackageIcon className="h-3 w-3 mr-1" />
          In Stock
        </Button>
        
        <Button
          variant={filters.foilOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => onFiltersChange({ ...filters, foilOnly: !filters.foilOnly })}
        >
          ✨ Foil Only
        </Button>

        <Separator orientation="vertical" className="h-6" />

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <FilterIcon className="h-3 w-3 mr-1" />
          Advanced Filters
          {showAdvanced ? <ChevronUpIcon className="h-3 w-3 ml-1" /> : <ChevronDownIcon className="h-3 w-3 ml-1" />}
        </Button>

        {activeFiltersCount > 0 && (
          <>
            <Badge variant="secondary" className="text-xs">
              {activeFiltersCount} filter{activeFiltersCount !== 1 ? 's' : ''} active
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
            >
              <XIcon className="h-3 w-3 mr-1" />
              Clear
            </Button>
          </>
        )}
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm">
        <div className="text-muted-foreground">
          Showing {filteredCards.toLocaleString()} of {totalCards.toLocaleString()} cards
        </div>
      </div>

      {/* Advanced Filters */}
      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleContent className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Condition Filter */}
                <div>
                  <label className="text-sm font-medium mb-3 block">Condition</label>
                  <div className="space-y-2">
                    {availableConditions.map(condition => (
                      <div key={condition} className="flex items-center space-x-2">
                        <Checkbox
                          id={`condition-${condition}`}
                          checked={filters.conditions.includes(condition)}
                          onCheckedChange={(checked) => {
                            const newConditions = checked
                              ? [...filters.conditions, condition]
                              : filters.conditions.filter(c => c !== condition);
                            onFiltersChange({ ...filters, conditions: newConditions });
                          }}
                        />
                        <label htmlFor={`condition-${condition}`} className="text-sm cursor-pointer">
                          {condition}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Collections Filter */}
                <div>
                  <label className="text-sm font-medium mb-3 block">Collections</label>
                  <ScrollArea className="h-32">
                    <div className="space-y-2">
                      {availableCollections.slice(0, 10).map(collection => (
                        <div key={collection} className="flex items-center space-x-2">
                          <Checkbox
                            id={`collection-${collection}`}
                            checked={filters.collections.includes(collection)}
                            onCheckedChange={(checked) => {
                              const newCollections = checked
                                ? [...filters.collections, collection]
                                : filters.collections.filter(c => c !== collection);
                              onFiltersChange({ ...filters, collections: newCollections });
                            }}
                          />
                          <label htmlFor={`collection-${collection}`} className="text-xs truncate cursor-pointer">
                            {collection}
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

// Enhanced card image loading with caching
const useCardImage = (card: OutpostCard) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  const maxRetries = 2;
  const shouldLoad = shouldFetchScryfallData(card.name);
  
  useEffect(() => {
    if (!shouldLoad) return;
    
    let isCancelled = false;
    
    const loadImage = async () => {
      if (loading || error || imageUrl || isCancelled) return;
      
      setLoading(true);
      setError(false);
      
      try {
        // Use the same simple logic as the modal
        const scryfallCard = await getCardForThumbnail(card.name);
        
        if (isCancelled) return;
        
        if (scryfallCard) {
          const thumbnailUrl = getCardThumbnail(scryfallCard);
          if (thumbnailUrl) {
            setImageUrl(thumbnailUrl);
          } else {
            setError(true);
          }
        } else {
          setError(true);
        }
      } catch (error) {
        console.warn(`Failed to load image for ${card.name}:`, error);
        if (!isCancelled) {
          if (retryCount < maxRetries) {
            setRetryCount(prev => prev + 1);
            setTimeout(() => loadImage(), 1000 * (retryCount + 1));
          } else {
            setError(true);
          }
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };
    
    loadImage();
    
    return () => {
      isCancelled = true;
    };
  }, [card.name, shouldLoad, loading, error, imageUrl, retryCount]);
  
  return { imageUrl, loading, error };
};

// Cache status component
const CacheStatus: React.FC = () => {
  const [cacheStats, setCacheStats] = useState({ inMemoryCount: 0, persistentCount: 0, persistentSizeKB: 0 });
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    // Set client-side flag and initial cache stats
    setIsClient(true);
    setCacheStats(getCacheStats());
    
    const interval = setInterval(() => {
      setCacheStats(getCacheStats());
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);
  
  const handleClearCache = () => {
    clearImageCache();
    setCacheStats(getCacheStats());
    toast.success('Image cache cleared');
  };
  
  // Don't render until client-side
  if (!isClient) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <DatabaseIcon className="h-4 w-4" />
        <span>Cache: Loading...</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <DatabaseIcon className="h-4 w-4" />
      <span>Cache: {cacheStats.persistentCount} images ({cacheStats.persistentSizeKB}KB)</span>
      <Button 
        variant="ghost" 
        size="sm"
        onClick={handleClearCache}
        className="h-6 px-2"
      >
        <RefreshCwIcon className="h-3 w-3" />
        Clear
      </Button>
    </div>
  );
};

export default function CardSearch() {
  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const [selectedCard, setSelectedCard] = useState<OutpostCard | null>(null);
  const [cardThumbnails, setCardThumbnails] = useState<Map<string, string>>(new Map());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'stock' | 'collection'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isFiltering, setIsFiltering] = useState(false);
  const [filters, setFilters] = useState({
    availableOnly: false,
    foilOnly: false,
    rarities: [] as string[],
    priceRange: [0, 1000] as [number, number],
    collections: [] as string[],
    conditions: [] as string[]
  });

  // Faster debounce for autocomplete suggestions (200ms)
  const debouncedSearchTerm = useDebounce(localSearchTerm, 200);
  const { outpostData, isLoading } = useStore();

  const availableCollections = useMemo(() => {
    const collections = new Set(outpostData.map(card => card.collection));
    return Array.from(collections).sort();
  }, [outpostData]);

  // Generate search suggestions
  const searchSuggestions = useMemo(() => {
    if (!localSearchTerm || localSearchTerm.length < 2) return [];
    
    const suggestions: SearchSuggestion[] = [];
    const searchLower = localSearchTerm.toLowerCase();
    const isSetSearch = searchLower.startsWith('@');
    
    if (isSetSearch) {
      // Set search suggestions
      const setQuery = searchLower.slice(1);
      const setMap = new Map<string, { full: string; count: number }>();
      
      outpostData.forEach(card => {
        const collection = card.collection.toLowerCase();
        if (collection.includes(setQuery)) {
          const existing = setMap.get(collection);
          if (existing) {
            existing.count++;
          } else {
            setMap.set(collection, { full: card.collection, count: 1 });
          }
        }
      });
      
      Array.from(setMap.entries())
        .sort(([,a], [,b]) => b.count - a.count)
        .slice(0, 5)
        .forEach(([key, data]) => {
          suggestions.push({
            type: 'set',
            value: `@${key}`,
            label: data.full,
            count: data.count
          });
        });
    } else {
      // Card name suggestions
      const cardMatches = new Map<string, { card: OutpostCard; count: number }>();
      
      outpostData.forEach(card => {
        if (card.name.toLowerCase().includes(searchLower)) {
          const key = card.name.toLowerCase();
          const existing = cardMatches.get(key);
          if (existing) {
            existing.count++;
          } else {
            cardMatches.set(key, { card, count: 1 });
          }
        }
      });
      
      Array.from(cardMatches.values())
        .sort((a, b) => {
          // Prioritize exact matches and available cards
          const aExact = a.card.name.toLowerCase().startsWith(searchLower) ? 1 : 0;
          const bExact = b.card.name.toLowerCase().startsWith(searchLower) ? 1 : 0;
          if (aExact !== bExact) return bExact - aExact;
          
          const aAvailable = (a.card.conditions && a.card.conditions.length > 0 && a.card.conditions.some(c => c.stock > 0)) ? 1 : 0;
          const bAvailable = (b.card.conditions && b.card.conditions.length > 0 && b.card.conditions.some(c => c.stock > 0)) ? 1 : 0;
          if (aAvailable !== bAvailable) return bAvailable - aAvailable;
          
          return b.count - a.count;
        })
        .slice(0, 6)
        .forEach(({ card, count }) => {
          const hasStock = (card.conditions && card.conditions.length > 0 && card.conditions.some(c => c.stock > 0));
          suggestions.push({
            type: 'card',
            value: card.name,
            label: card.name,
            extra: hasStock ? 'In Stock' : 'Out of Stock',
            count
          });
        });
      
      // Collection suggestions
      const collectionMatches = availableCollections
        .filter(collection => collection.toLowerCase().includes(searchLower))
        .slice(0, 3);
      
      collectionMatches.forEach(collection => {
        const count = outpostData.filter(card => card.collection === collection).length;
        suggestions.push({
          type: 'collection',
          value: collection,
          label: collection,
          count
        });
      });
    }
    
    return suggestions;
  }, [localSearchTerm, outpostData, availableCollections]);

  // Filter and sort cards with performance optimization
  const filteredCards = useMemo(() => {
    if (!outpostData) return [];

    console.log('Filtering cards...', {
      totalCards: outpostData.length,
      searchTerm: debouncedSearchTerm,
      filters,
      sampleCard: outpostData[0], // Log first card to see structure
      hasConditions: outpostData[0]?.conditions ? 'YES' : 'NO'
    });

    setIsFiltering(true);

    let cards = searchCards(outpostData, debouncedSearchTerm);

    // Filter out underscore-only cards unless specifically searching
    if (!debouncedSearchTerm.includes('_')) {
      cards = cards.filter(card => !card.name.match(/^_+$/));
    }

    // Apply filters
    if (filters.availableOnly) {
      cards = cards.filter(card => 
        card.conditions && card.conditions.length > 0 && card.conditions.some(c => c.stock > 0)
      );
    }

    if (filters.foilOnly) {
      cards = cards.filter(card => card.foil);
    }

    if (filters.rarities.length > 0) {
      cards = cards.filter(card => filters.rarities.includes(card.rarity));
    }

    if (filters.conditions.length > 0) {
      cards = cards.filter(card => 
        card.conditions && card.conditions.length > 0 && 
        card.conditions.some(condition => filters.conditions.includes(condition.condition))
      );
    }

    if (filters.collections.length > 0) {
      cards = cards.filter(card => filters.collections.includes(card.collection));
    }

    // Price range filter (convert euros to cents)
    const [minPrice, maxPrice] = filters.priceRange;
    cards = cards.filter(card => {
      // Safety check: ensure card.conditions exists and has at least one condition
      if (!card.conditions || card.conditions.length === 0) {
        return false;
      }
      const cardMinPrice = Math.min(...card.conditions.map(c => c.price));
      return cardMinPrice >= minPrice * 100 && cardMinPrice <= maxPrice * 100;
    });

    // Sort cards
    cards.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortBy) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'price':
          // Safety check for conditions
          aVal = (a.conditions && a.conditions.length > 0) 
            ? Math.min(...a.conditions.map(c => c.price)) 
            : Number.MAX_SAFE_INTEGER;
          bVal = (b.conditions && b.conditions.length > 0) 
            ? Math.min(...b.conditions.map(c => c.price)) 
            : Number.MAX_SAFE_INTEGER;
          break;
        case 'stock':
          // Safety check for conditions
          aVal = (a.conditions && a.conditions.length > 0) 
            ? a.conditions.reduce((sum, c) => sum + c.stock, 0) 
            : 0;
          bVal = (b.conditions && b.conditions.length > 0) 
            ? b.conditions.reduce((sum, c) => sum + c.stock, 0) 
            : 0;
          break;
        case 'collection':
          aVal = a.collection.toLowerCase();
          bVal = b.collection.toLowerCase();
          break;
        default:
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
      }
      
      const result = sortDirection === 'asc' 
        ? (aVal < bVal ? -1 : aVal > bVal ? 1 : 0)
        : (aVal > bVal ? -1 : aVal < bVal ? 1 : 0);
        
      return result;
    });

    setTimeout(() => setIsFiltering(false), 100);
    return cards.slice(0, 500); // Limit for performance
  }, [outpostData, debouncedSearchTerm, sortBy, sortDirection, filters]);

  const displayedCards = filteredCards.slice(0, 500);

  // Enhanced image loading with better error handling and more comprehensive fetching
  useEffect(() => {
    const fetchThumbnails = async () => {
      // Load more cards at once for better UX (up to 100 cards)
      const cardsToLoad = displayedCards.slice(0, 100);
      const cardsNeedingImages = cardsToLoad.filter(card => 
        !cardThumbnails.has(card.name) && shouldFetchScryfallData(card.name)
      );

      if (cardsNeedingImages.length === 0) return;

      console.log(`Loading images for ${cardsNeedingImages.length} cards...`);

      // Process cards in smaller batches to avoid overwhelming the API
      const BATCH_SIZE = 10;
      const newThumbnails = new Map(cardThumbnails);
      
      for (let i = 0; i < cardsNeedingImages.length; i += BATCH_SIZE) {
        const batch = cardsNeedingImages.slice(i, i + BATCH_SIZE);
        
        const promises = batch.map(async (card) => {
          try {
            // Use the same simple logic as the modal - more reliable
            const scryfallCard = await getCardForThumbnail(card.name);

            if (scryfallCard) {
              const thumbnailUrl = getCardThumbnail(scryfallCard);
              if (thumbnailUrl) {
                return [card.name, thumbnailUrl] as [string, string];
              }
            }
            
            console.warn(`No image found for: ${card.name} (${card.collection})`);
            return null;
          } catch (error) {
            console.error(`Error fetching image for ${card.name}:`, error);
            return null;
          }
        });

        const results = await Promise.all(promises);
        
        results.forEach((result) => {
          if (result) {
            newThumbnails.set(result[0], result[1]);
          }
        });

        // Update state after each batch for progressive loading
        if (newThumbnails.size > cardThumbnails.size) {
          setCardThumbnails(new Map(newThumbnails));
        }

        // Small delay between batches to be respectful to the API
        if (i + BATCH_SIZE < cardsNeedingImages.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`Loaded ${newThumbnails.size - cardThumbnails.size} new images`);
    };

    fetchThumbnails();
  }, [displayedCards, cardThumbnails]);

  const handleSort = (newSortBy: typeof sortBy) => {
    if (sortBy === newSortBy) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortDirection('asc');
    }
  };

  const handleCardClick = useCallback((card: OutpostCard) => {
    setSelectedCard(card);
  }, []);

  // Show loading state
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <LoadingSpinner />
          <span className="ml-2 text-muted-foreground">Loading card data...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Search and Filter Section */}
      <Card>
        <CardContent className="p-6 space-y-4">
          {/* Search and View Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:gap-4">
            {/* Enhanced Search Input with Autocomplete */}
            <SearchInput
              value={localSearchTerm}
              onChange={setLocalSearchTerm}
              suggestions={searchSuggestions}
              placeholder="Search cards... Use @bloom for Bloomburrow sets"
            />

            {/* View Mode and Sort Controls */}
            <div className="flex items-center gap-4">
              {/* View Mode Toggle */}
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                >
                  <GridIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  <ListIcon className="h-4 w-4" />
                </Button>
              </div>

              {/* Sort Controls */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Sort by:</span>
                <Select value={sortBy} onValueChange={(value: any) => handleSort(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="price">Price</SelectItem>
                    <SelectItem value="stock">Stock</SelectItem>
                    <SelectItem value="collection">Collection</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                >
                  {sortDirection === 'asc' ? <SortAscIcon className="h-4 w-4" /> : <SortDescIcon className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Integrated Filters */}
          <IntegratedFilters
            filters={filters}
            onFiltersChange={setFilters}
            availableCollections={availableCollections}
            totalCards={outpostData.length}
            filteredCards={filteredCards.length}
          />
        </CardContent>
      </Card>

      {/* Loading State */}
      {isFiltering && (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <LoadingSpinner />
            <span className="ml-2 text-muted-foreground">Filtering cards...</span>
          </CardContent>
        </Card>
      )}

      {/* Cards Display */}
      {!isFiltering && displayedCards.length > 0 ? (
        <Card>
          <CardContent className="p-6">
            {filteredCards.length > 500 && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Performance Note:</strong> Showing first 500 of {filteredCards.length.toLocaleString()} results. 
                  Please refine your search to see more specific results.
                </p>
              </div>
            )}
            
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
                {displayedCards.map((card) => (
                  <CardItem
                    key={`${card.name}-${card.collection}-${card.foil}`}
                    card={card}
                    onCardClick={handleCardClick}
                    cardThumbnails={cardThumbnails}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {displayedCards.map((card) => (
                  <ListItem
                    key={`${card.name}-${card.collection}-${card.foil}`}
                    card={card}
                    onCardClick={handleCardClick}
                    cardThumbnails={cardThumbnails}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : !isFiltering && (
        <Card>
          <CardContent className="text-center py-12">
            <SearchIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No cards found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search terms or filters to find cards.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Cache Status */}
      <div className="flex justify-center">
        <CacheStatus />
      </div>

      {/* Card Detail Modal */}
      {selectedCard && (
        <CardDetailModal
          card={selectedCard}
          isOpen={!!selectedCard}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </div>
  );
} 