import { useState, useEffect } from 'react';
import Head from 'next/head';
import useStore from '@/lib/store';
import { fetchMoxfieldDeck, parseMoxfieldUrl, formatDate } from '@/lib/utils';
import DeckAnalysis from '@/components/DeckAnalysis';
import CardSearch from '@/components/CardSearch';
import LoadingSpinner from '@/components/LoadingSpinner';
import CollectionStatus from '@/components/CollectionStatus';
import ShoppingCart from '@/components/ShoppingCart';
import { Toaster } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingCartIcon, RefreshCwIcon } from 'lucide-react';

export default function Home() {
  const [deckUrl, setDeckUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'deck' | 'search' | 'collections'>('search');
  const [error, setError] = useState<string | null>(null);

  const { analyzeDeck, deckAnalysis, currentDeck, outpostData, isLoading, lastDataRefresh, refreshData, loadOutpostData, isBasketOpen, toggleBasket, getBasketSummary, removeToast } = useStore();
  
  const basketSummary = getBasketSummary();

  // Load data on page mount
  useEffect(() => {
    loadOutpostData();
  }, [loadOutpostData]);

  const handleAnalyzeDeck = async () => {
    if (!deckUrl.trim()) {
      setError('Please enter a Moxfield deck URL');
      return;
    }

    const deckId = parseMoxfieldUrl(deckUrl);
    if (!deckId) {
      setError('Invalid Moxfield URL. Please enter a valid deck URL.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const deck = await fetchMoxfieldDeck(deckId);
      analyzeDeck(deck);
      setActiveTab('deck'); // Switch to deck analysis tab
    } catch (err) {
      setError('Failed to analyze deck. Please try again.');
      console.error('Error analyzing deck:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRefresh = async () => {
    await refreshData();
  };

  return (
    <>
      <Head>
        <title>Outpost MTG Inventory Checker</title>
        <meta name="description" content="Check MTG card availability at Outpost Gaming Belgium" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <img 
                  src="/logo.webp" 
                  alt="Outpost Gaming Belgium Logo" 
                  className="h-10 w-auto"
                />
                <h1 className="text-2xl font-bold text-foreground">
                  Outpost MTG Inventory Checker
                </h1>
              </div>
              <div className="flex items-center space-x-4">
                {lastDataRefresh && (
                  <span className="text-sm text-muted-foreground">
                    Last updated: {formatDate(lastDataRefresh)}
                  </span>
                )}
                
                {/* Shopping Cart Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleBasket}
                  className="relative"
                >
                  <ShoppingCartIcon className="h-4 w-4 mr-2" />
                  Cart
                  {basketSummary.totalItems > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    >
                      {basketSummary.totalItems}
                    </Badge>
                  )}
                </Button>
                
                <Button onClick={handleRefresh} size="sm">
                  <RefreshCwIcon className="h-4 w-4 mr-2" />
                  Refresh Data
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="deck">Deck Analysis</TabsTrigger>
              <TabsTrigger value="search">
                Card Search
                <Badge variant="secondary" className="ml-2">
                  107636
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="collections">Collection Status</TabsTrigger>
            </TabsList>

            <div className="mt-6">
              <TabsContent value="deck">
                <DeckAnalysis />
              </TabsContent>
              
              <TabsContent value="search">
                <CardSearch />
              </TabsContent>
              
              <TabsContent value="collections">
                <CollectionStatus />
              </TabsContent>
            </div>
          </Tabs>
        </main>
        
        {/* Shopping Cart */}
        <ShoppingCart 
          isOpen={isBasketOpen} 
          onClose={() => toggleBasket()} 
        />
        
        {/* Toast Notifications */}
        <Toaster />
      </div>
    </>
  );
} 