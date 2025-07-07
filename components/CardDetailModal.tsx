import { useState, useEffect } from 'react';
import { OutpostCard, CardCondition } from '@/lib/types';
import { 
  ScryfallCard, 
  getAllPrintings, 
  getCardByNameAndSet,
  getEdhrecData,
  getCardHighRes,
  getCardThumbnail,
  formatManaCost,
  getRarityColor,
  shouldFetchScryfallData
} from '@/lib/scryfall';
import { formatPrice } from '@/lib/utils';
import LoadingSpinner from './LoadingSpinner';
import useStore from '@/lib/store';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ExternalLinkIcon, 
  StarIcon, 
  TrendingUpIcon, 
  ImageIcon,
  PackageIcon,
  TagIcon,
  GlassesIcon,
  ShoppingCartIcon,
  SparklesIcon
} from 'lucide-react';
import { toast } from 'sonner';

interface CardDetailModalProps {
  card: OutpostCard;
  isOpen: boolean;
  onClose: () => void;
}

export default function CardDetailModal({ card, isOpen, onClose }: CardDetailModalProps) {
  const [scryfallData, setScryfallData] = useState<ScryfallCard | null>(null);
  const [allPrintings, setAllPrintings] = useState<ScryfallCard[]>([]);
  const [edhrecData, setEdhrecData] = useState<any>(null);
  const [selectedPrinting, setSelectedPrinting] = useState<ScryfallCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'printings' | 'edhrec'>('details');
  const [imageError, setImageError] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState<string>('');
  const { addToBasket } = useStore();

  // Get available conditions for purchase
  const availableConditions = card.conditions?.filter(c => c.stock > 0) || [];
  const allConditions = card.conditions || [];

  // Set default condition to best available (cheapest)
  useEffect(() => {
    if (availableConditions.length > 0 && !selectedCondition) {
      const bestCondition = availableConditions.sort((a, b) => a.price - b.price)[0];
      setSelectedCondition(bestCondition.condition);
    }
  }, [availableConditions, selectedCondition]);

  const currentCondition = availableConditions.find(c => c.condition === selectedCondition) || availableConditions[0];

  useEffect(() => {
    if (isOpen && shouldFetchScryfallData(card.name)) {
      fetchCardData();
    }
  }, [isOpen, card.name]);

  const fetchCardData = async () => {
    setLoading(true);
    setImageError(false);
    
    try {
      // Fetch main card data
      const mainCard = await getCardByNameAndSet(card.name);
      setScryfallData(mainCard);
      setSelectedPrinting(mainCard);
      
      // Fetch all printings
      const printings = await getAllPrintings(card.name);
      setAllPrintings(printings);
      
      // Fetch EDHREC data
      const edhrec = await getEdhrecData(card.name);
      setEdhrecData(edhrec);
      
    } catch (error) {
      console.error('Error fetching card data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageError = () => {
    setImageError(true);
  };

  const handleClose = () => {
    setScryfallData(null);
    setAllPrintings([]);
    setEdhrecData(null);
    setSelectedPrinting(null);
    setActiveTab('details');
    setImageError(false);
    setSelectedCondition('');
    onClose();
  };

  const handleAddToCart = () => {
    if (currentCondition) {
      addToBasket(card, currentCondition, 1);
      toast.success(`Added ${card.name} (${currentCondition.condition}) to cart`);
    } else {
      toast.error('No stock available for this card');
    }
  };

  const displayCard = selectedPrinting || scryfallData;
  const hasImage = displayCard && getCardHighRes(displayCard) && !imageError;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold">{card.name}</span>
              {displayCard && (
                <Badge 
                  variant="secondary"
                  style={{ backgroundColor: getRarityColor(displayCard.rarity) }}
                  className="text-white"
                >
                  {displayCard.rarity}
                </Badge>
              )}
              {card.foil && (
                <Badge className="bg-yellow-500 text-yellow-950">
                  <SparklesIcon className="h-3 w-3 mr-1" />
                  Foil
                </Badge>
              )}
            </div>
            <Badge variant="outline" className="text-sm">
              {card.collection}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 max-h-[calc(95vh-8rem)]">
          {/* Left Side - Card Image */}
          <div className="lg:col-span-2 flex flex-col">
            {loading ? (
              <Card className="aspect-[5/7] flex items-center justify-center">
                <CardContent className="flex flex-col items-center gap-3">
                  <LoadingSpinner />
                  <span className="text-muted-foreground">Loading card details...</span>
                </CardContent>
              </Card>
            ) : hasImage ? (
              <div className="relative">
                <img
                  src={getCardHighRes(displayCard!)}
                  alt={displayCard!.name}
                  className="w-full h-auto rounded-lg shadow-lg"
                  onError={handleImageError}
                />
                {displayCard!.card_faces && displayCard!.card_faces.length > 1 && (
                  <Badge variant="secondary" className="absolute bottom-2 left-2">
                    Double-faced card
                  </Badge>
                )}
              </div>
            ) : (
              <Card className="aspect-[5/7] flex items-center justify-center bg-muted">
                <CardContent className="text-center">
                  <ImageIcon className="h-16 w-16 text-muted-foreground mb-3 mx-auto" />
                  <div className="text-muted-foreground">No image available</div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Side - Content */}
          <div className="lg:col-span-3 flex flex-col">
            {/* Outpost Purchase Section - Prominent */}
            <Card className="mb-6 border-2 border-blue-200 bg-blue-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <PackageIcon className="h-5 w-5" />
                  Available at Outpost Gaming Belgium
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Condition Selector */}
                  {availableConditions.length > 1 && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">Condition:</span>
                      <Select value={selectedCondition} onValueChange={setSelectedCondition}>
                        <SelectTrigger className="w-64">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableConditions.map((condition) => (
                            <SelectItem key={condition.condition} value={condition.condition}>
                              {condition.condition} - {formatPrice(condition.price / 100)} ({condition.stock} available)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Price and Stock Display */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-3xl font-bold text-green-600">
                        {currentCondition ? formatPrice(currentCondition.price / 100) : 'Out of Stock'}
                      </div>
                      {currentCondition && (
                        <div className="text-sm text-muted-foreground">
                          {currentCondition.condition} condition • {currentCondition.stock} available
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={handleAddToCart}
                      disabled={!currentCondition}
                      size="lg"
                      className="px-8"
                    >
                      <ShoppingCartIcon className="h-4 w-4 mr-2" />
                      Add to Cart
                    </Button>
                  </div>

                  {/* All Conditions Overview */}
                  <div>
                    <div className="text-sm font-medium mb-2">All Available Conditions:</div>
                    <div className="grid grid-cols-2 gap-2">
                      {allConditions.map((condition, index) => (
                        <div 
                          key={index}
                          className={`p-2 rounded border ${
                            condition.stock > 0 
                              ? 'bg-green-50 border-green-200' 
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">{condition.condition}</span>
                            <span className="text-sm font-semibold">
                              {formatPrice(condition.price / 100)}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {condition.stock > 0 ? `${condition.stock} available` : 'Out of stock'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabs for Additional Information */}
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="flex-1">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Card Details</TabsTrigger>
                <TabsTrigger value="printings">
                  Other Printings
                  {allPrintings.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {allPrintings.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="edhrec">
                  EDHREC Data
                  {edhrecData && (
                    <Badge variant="secondary" className="ml-2">
                      ♦
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <div className="mt-4 flex-1">
                <TabsContent value="details" className="h-full">
                  <ScrollArea className="h-[400px]">
                    {displayCard ? (
                      <div className="space-y-4">
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <GlassesIcon className="h-5 w-5" />
                              Card Information
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <strong>Mana Cost:</strong>
                                <div className="mt-1">{formatManaCost(displayCard.mana_cost || '')}</div>
                              </div>
                              <div>
                                <strong>Type:</strong>
                                <div className="mt-1">{displayCard.type_line}</div>
                              </div>
                              <div>
                                <strong>Set:</strong>
                                <div className="mt-1">{displayCard.set_name}</div>
                              </div>
                              <div>
                                <strong>Rarity:</strong>
                                <div className="mt-1">
                                  <Badge style={{ backgroundColor: getRarityColor(displayCard.rarity) }} className="text-white">
                                    {displayCard.rarity}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            
                            {displayCard.oracle_text && (
                              <div>
                                <strong>Oracle Text:</strong>
                                <div className="mt-2 text-sm bg-muted p-4 rounded whitespace-pre-wrap">
                                  {displayCard.oracle_text}
                                </div>
                              </div>
                            )}
                            
                            {displayCard.power && displayCard.toughness && (
                              <div>
                                <strong>Power/Toughness:</strong>
                                <div className="mt-1 text-lg font-semibold">{displayCard.power}/{displayCard.toughness}</div>
                              </div>
                            )}
                            
                            {(displayCard as any).loyalty && (
                              <div>
                                <strong>Loyalty:</strong>
                                <div className="mt-1 text-lg font-semibold">{(displayCard as any).loyalty}</div>
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {displayCard.legalities && (
                          <Card>
                            <CardHeader>
                              <CardTitle>Format Legality</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-3 gap-2">
                                {Object.entries(displayCard.legalities)
                                  .filter(([format]) => ['standard', 'pioneer', 'modern', 'legacy', 'vintage', 'commander'].includes(format))
                                  .map(([format, legality]) => (
                                  <div key={format} className="flex items-center justify-between">
                                    <span className="text-sm capitalize">{format}</span>
                                    <Badge 
                                      variant={
                                        legality === 'legal' ? 'default' : 
                                        legality === 'restricted' ? 'secondary' : 
                                        'destructive'
                                      }
                                      className="text-xs"
                                    >
                                      {legality}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        No detailed card information available
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="printings" className="h-full">
                  <ScrollArea className="h-[400px]">
                    <div className="grid grid-cols-1 gap-3">
                      {allPrintings.map((printing) => (
                        <Card 
                          key={printing.id}
                          className={`cursor-pointer transition-all ${
                            selectedPrinting?.id === printing.id ? 'ring-2 ring-blue-500' : ''
                          }`}
                          onClick={() => setSelectedPrinting(printing)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center gap-4">
                              <img
                                src={getCardThumbnail(printing)}
                                alt={printing.name}
                                className="w-12 h-12 object-cover rounded"
                              />
                              <div className="flex-1">
                                <div className="font-medium">{printing.set_name}</div>
                                <div className="text-sm text-muted-foreground">
                                  #{printing.collector_number} • {printing.rarity}
                                </div>
                              </div>
                              {printing.prices?.usd && (
                                <div className="text-right">
                                  <div className="text-sm font-medium">
                                    ${printing.prices.usd} USD
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Market price
                                  </div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="edhrec" className="h-full">
                  <ScrollArea className="h-[400px]">
                    {edhrecData ? (
                      <div className="space-y-4">
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <TrendingUpIcon className="h-5 w-5" />
                              EDHREC Statistics
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-3 gap-4">
                              <div className="text-center">
                                <div className="text-2xl font-bold text-blue-600">#{edhrecData.rank}</div>
                                <div className="text-sm text-muted-foreground">Rank</div>
                              </div>
                              <div className="text-center">
                                <div className="text-2xl font-bold text-orange-600">{edhrecData.salt}</div>
                                <div className="text-sm text-muted-foreground">Salt Score</div>
                              </div>
                              <div className="text-center">
                                <div className="text-2xl font-bold text-green-600">{edhrecData.inclusion_rate}%</div>
                                <div className="text-sm text-muted-foreground">Inclusion Rate</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle>View on EDHREC</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <Button 
                              variant="outline"
                              onClick={() => window.open(edhrecData.url, '_blank')}
                              className="w-full"
                            >
                              <ExternalLinkIcon className="h-4 w-4 mr-2" />
                              Open EDHREC Page
                            </Button>
                          </CardContent>
                        </Card>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        No EDHREC data available
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 