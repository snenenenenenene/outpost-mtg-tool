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
import { Analytics } from "@vercel/analytics/next"

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
      <Analytics />
      
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-gradient-to-r from-white/80 via-blue-50/80 to-purple-50/80 dark:from-gray-900/80 dark:via-blue-900/20 dark:to-purple-900/20 backdrop-blur-lg supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-gray-900/80 shadow-sm">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <img 
                  src="/logo.webp" 
                  alt="Outpost Gaming Belgium Logo" 
                  className="h-10 w-auto drop-shadow-sm"
                />
              </div>
              <div className="flex items-center space-x-2 sm:space-x-4">
                {lastDataRefresh && (
                  <span className="hidden sm:block text-sm text-muted-foreground bg-white/50 dark:bg-gray-800/50 px-3 py-1 rounded-full backdrop-blur-sm">
                    Last updated: {formatDate(lastDataRefresh)}
                  </span>
                )}
                
                {/* Shopping Cart Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleBasket}
                  className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-gray-200/50 dark:border-gray-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-300 shadow-sm hover:shadow-md"
                >
                  <ShoppingCartIcon className="h-4 w-4 mr-0 sm:mr-2" />
                  <span className="hidden sm:inline">Cart</span>
                  {basketSummary.totalItems > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs shadow-lg animate-pulse"
                    >
                      {basketSummary.totalItems}
                    </Badge>
                  )}
                </Button>
                
                {/* <Button onClick={handleRefresh} size="sm">
                  <RefreshCwIcon className="h-4 w-4 mr-2" />
                  Refresh Data
                </Button> */}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
            <TabsList className="grid w-full grid-cols-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-900 border-gray-200/50 dark:border-gray-700/50 shadow-sm backdrop-blur-sm">
              <TabsTrigger 
                value="deck" 
                className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-md transition-all duration-300"
              >
                Deck Analysis
              </TabsTrigger>
              <TabsTrigger 
                value="search"
                className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-md transition-all duration-300"
              >
                Card Search
                <Badge variant="secondary" className="ml-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-sm">
                  {outpostData.length.toLocaleString()}
                </Badge>
              </TabsTrigger>
              <TabsTrigger 
                value="collections"
                className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-md transition-all duration-300"
              >
                Collection Status
              </TabsTrigger>
            </TabsList>

            <div className="mt-6">
              <TabsContent value="deck" className="animate-in fade-in-50 duration-300">
                <DeckAnalysis />
              </TabsContent>
              
              <TabsContent value="search" className="animate-in fade-in-50 duration-300">
                <CardSearch />
              </TabsContent>
              
              <TabsContent value="collections" className="animate-in fade-in-50 duration-300">
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