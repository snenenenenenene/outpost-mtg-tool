const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

// Base URLs for Outpost website
const BASE_URL = 'https://www.outpost.be/website/';
const CATALOG_URL = 'https://www.outpost.be/website/index.php?option=com_outpostshop&view=catalog&catalogid=1&Itemid=4';

// Function to get collection URL
const getCollectionUrl = (collectionId) => 
  `${BASE_URL}index.php?option=com_outpostshop&Itemid=4&view=productlist&catalogid=1&collectionid=${collectionId}`;

// Rate limiting helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Parse card data from HTML attributes and condition details
function parseCardData(cardElement, $) {
  const cardData = {
    name: cardElement.attr('elnm') || '',
    alphabet: cardElement.attr('alphabet') || '',
    rarity: cardElement.attr('magicrarity') || '',
    foil: cardElement.attr('foil') === '1',
    colors: {
      white: cardElement.attr('cw') === '1',
      blue: cardElement.attr('cu') === '1',
      black: cardElement.attr('cb') === '1',
      red: cardElement.attr('cr') === '1',
      green: cardElement.attr('cg') === '1',
      colorless: cardElement.attr('cnocol') === '1'
    }
  };

  // Extract condition-specific data from .outpost_sli_sale elements
  const conditions = [];
  cardElement.find('.outpost_sli_sale').each((i, saleElement) => {
    const saleEl = $(saleElement);
    
    // Extract condition/quality
    const conditionText = saleEl.find('.outpost_sli_quality').text().trim();
    
    // Extract stock (from element with id like "ostk...")
    const stockElement = saleEl.find('[id^="ostk"]');
    const stock = parseInt(stockElement.text().trim() || '0', 10);
    
    // Extract price (convert from "0.26 €" format to cents)
    const priceText = saleEl.find('.outpost_sli_price').text().trim();
    const priceMatch = priceText.match(/(\d+\.?\d*)/);
    const priceEuros = priceMatch ? parseFloat(priceMatch[1]) : 0;
    const priceCents = Math.round(priceEuros * 100);
    
    // Extract Outpost ID from stock element or cart element
    let outpostId = '';
    if (stockElement.length > 0) {
      const stockId = stockElement.attr('id');
      if (stockId) {
        outpostId = stockId.replace('ostk', '');
      }
    }
    
    // Only include conditions with valid prices OR valid stock
    // Filter out conditions with both 0 price AND 0 stock (likely placeholders)
    if (conditionText && conditionText !== '' && (priceCents > 0 || stock > 0)) {
      conditions.push({
        condition: conditionText,
        price: priceCents,
        stock: stock,
        priceFormatted: priceText,
        outpostId: outpostId
      });
    }
  });

  // Set the conditions array
  cardData.conditions = conditions;

  // Compute backwards compatibility properties
  const validPriceConditions = conditions.filter(c => c.price > 0);
  const availableConditions = conditions.filter(c => c.stock > 0 && c.price > 0);
  
  if (availableConditions.length > 0) {
    // Price = cheapest available condition with valid price
    cardData.price = Math.min(...availableConditions.map(c => c.price));
    cardData.priceFormatted = availableConditions.find(c => c.price === cardData.price).priceFormatted;
  } else if (validPriceConditions.length > 0) {
    // If no available stock, use cheapest valid price
    cardData.price = Math.min(...validPriceConditions.map(c => c.price));
    cardData.priceFormatted = validPriceConditions.find(c => c.price === cardData.price).priceFormatted;
  } else {
    // If no valid prices found, try fallback to original attributes
    const fallbackPrice = parseInt(cardElement.attr('price') || '0', 10);
    if (fallbackPrice > 0) {
      cardData.price = fallbackPrice;
      cardData.priceFormatted = (cardData.price / 100).toFixed(2) + ' €';
    } else {
      cardData.price = 0;
      cardData.priceFormatted = '0.00 €';
    }
  }
  
  // Stock = sum of all condition stocks
  cardData.stock = conditions.reduce((sum, c) => sum + c.stock, 0);

  // Extract additional details from card content
  const setElement = cardElement.find('.outpost_sli_set_mtg');
  if (setElement.length > 0) {
    cardData.set = setElement.text().trim();
  }

  // Extract image URL
  const imageElement = cardElement.find('img');
  if (imageElement.length > 0) {
    let imageUrl = imageElement.attr('src') || '';
    if (imageUrl && !imageUrl.startsWith('http')) {
      imageUrl = 'https://www.outpost.be/website/' + imageUrl;
    }
    cardData.imageUrl = imageUrl;
  }

  // Extract detail page URL
  const linkElement = cardElement.find('a[href*="view=detail"]');
  if (linkElement.length > 0) {
    let detailUrl = linkElement.attr('href') || '';
    if (detailUrl && !detailUrl.startsWith('http')) {
      detailUrl = 'https://www.outpost.be/website/' + detailUrl;
    }
    cardData.detailUrl = detailUrl;
  }

  return cardData;
}

// Parse collection data from catalog page
async function parseCollections() {
  try {
    console.log('Fetching catalog page...');
    const response = await axios.get(CATALOG_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const collections = [];

    // Find all collection links
    $('a[href*="collectionid="]').each((i, element) => {
      const href = $(element).attr('href');
      const collectionMatch = href.match(/collectionid=(\d+)/);
      
      if (collectionMatch) {
        const collectionId = collectionMatch[1];
        const collectionName = $(element).text().trim();
        
        // Skip if collection name is empty or too short
        if (collectionName && collectionName.length > 2) {
          collections.push({
            id: collectionId,
            name: collectionName,
            url: href.startsWith('http') ? href : BASE_URL + href
          });
        }
      }
    });

    console.log(`Found ${collections.length} collections`);
    return collections;
  } catch (error) {
    console.error('Error parsing collections:', error.message);
    return [];
  }
}

// Scrape cards from a specific collection
async function scrapeCollection(collection, maxCards = 50) {
  try {
    console.log(`Scraping collection: ${collection.name} (ID: ${collection.id})`);
    
    const response = await axios.get(collection.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const cards = [];
    let skippedCards = 0;
    let skipReasons = {
      noName: 0,
      noPrice: 0,
      noConditions: 0,
      noSet: 0
    };

    // Find all MTG card elements
    $('.outpost_shop_list_item_mtg').each((i, element) => {
      if (cards.length >= maxCards) return false; // Stop after maxCards
      
      const cardElement = $(element);
      const cardData = parseCardData(cardElement, $);
      
      // Data quality filters
      const hasValidName = cardData.name && cardData.name.trim() !== '';
      const hasValidPrice = cardData.price > 0;
      const hasValidConditions = cardData.conditions && cardData.conditions.length > 0;
      const hasValidSet = cardData.set && cardData.set.trim() !== '';
      
      // Include cards that have:
      // 1. Valid name
      // 2. Valid price (> 0)
      // 3. Valid conditions array
      // 4. Valid set information
      if (hasValidName && hasValidPrice && hasValidConditions && hasValidSet) {
        cards.push({
          ...cardData,
          collection: collection.name,
          collectionId: collection.id
        });
      } else {
        skippedCards++;
        // Track reasons for skipping (for summary)
        if (!hasValidName) skipReasons.noName++;
        if (!hasValidPrice) skipReasons.noPrice++;
        if (!hasValidConditions) skipReasons.noConditions++;
        if (!hasValidSet) skipReasons.noSet++;
      }
    });

    console.log(`Found ${cards.length} valid cards in ${collection.name} (skipped ${skippedCards} cards: ${skipReasons.noPrice} zero price, ${skipReasons.noSet} missing set, ${skipReasons.noName} missing name, ${skipReasons.noConditions} no conditions)`);
    return cards;
  } catch (error) {
    console.error(`Error scraping collection ${collection.name}:`, error.message);
    return [];
  }
}

// Main scraping function
async function scrapeOutpost() {
  const startTime = Date.now();
  console.log('Starting Outpost scraping...');

  try {
    // Get all collections
    const collections = await parseCollections();
    
    if (collections.length === 0) {
      console.log('No collections found. Exiting.');
      return;
    }

    // Priority collections to scrape first (latest sets and popular formats)
    const priorityCollections = [
      'Final Fantasy',
      'Foundations',
      'Duskmourn',
      'Bloomburrow',
      'Modern Horizons 3',
      'Outlaws of Thunder Junction',
      'Murders at Karlov Manor',
      'Commander',
      'Secret Lair Drop Series'
    ];

    // Sort collections by priority
    const sortedCollections = [...collections].sort((a, b) => {
      const aIndex = priorityCollections.findIndex(p => a.name.includes(p));
      const bIndex = priorityCollections.findIndex(p => b.name.includes(p));
      
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return 0;
    });

    let allCards = [];
    let processedCollections = 0;
    const maxCollections = 10; // Limit to prevent overwhelming the server

    // Scrape priority collections
    for (const collection of sortedCollections.slice(0, maxCollections)) {
      await scrapeCollection(collection, 100).then(cards => {
        allCards = allCards.concat(cards);
        processedCollections++;
      });
      
      // Rate limiting
      await delay(1000);
    }

    // Remove duplicates and consolidate to best available version per card name
    const uniqueCards = [];
    const cardGroups = new Map();
    
    // Group cards by name
    for (const card of allCards) {
      const cardName = card.name.toLowerCase().trim();
      if (!cardGroups.has(cardName)) {
        cardGroups.set(cardName, []);
      }
      cardGroups.get(cardName).push(card);
    }
    
    // For each card name, find the best available version
    for (const [cardName, cards] of cardGroups) {
      let bestCard = null;
      
      // Priority 1: Cards with stock > 0 and price > 0
      const availableCards = cards.filter(card => card.stock > 0 && card.price > 0);
      
      if (availableCards.length > 0) {
        // Among available cards, pick the cheapest one with the best quality
        bestCard = availableCards.sort((a, b) => {
          // First sort by price (ascending)
          const priceDiff = a.price - b.price;
          if (priceDiff !== 0) return priceDiff;
          
          // If prices are equal, prefer better quality (non-foil over foil for consistency)
          if (a.foil !== b.foil) return a.foil ? 1 : -1;
          
          // If still equal, prefer newer sets (just use the first one)
          return 0;
        })[0];
      } else {
        // Priority 2: If no cards have stock, pick the cheapest one with price > 0
        const validPriceCards = cards.filter(card => card.price > 0);
        if (validPriceCards.length > 0) {
          bestCard = validPriceCards.sort((a, b) => a.price - b.price)[0];
        }
      }
      
      if (bestCard) {
        uniqueCards.push(bestCard);
      }
    }
    
    console.log(`Total cards after consolidation: ${uniqueCards.length} (consolidated from ${allCards.length} variants)`);
    console.log(`Cards with stock: ${uniqueCards.filter(c => c.stock > 0).length}`);
    console.log(`Cards available (stock > 0): ${uniqueCards.filter(c => c.stock > 0).length}`);
    console.log(`Cards with valid prices: ${uniqueCards.filter(c => c.price > 0).length}`);

    // Data quality summary
    const totalPrice = uniqueCards.reduce((sum, card) => sum + card.price, 0);
    const averagePrice = totalPrice / uniqueCards.length / 100; // Convert to euros
    const cardsWithStock = uniqueCards.filter(card => card.stock > 0);
    const totalStock = uniqueCards.reduce((sum, card) => sum + card.stock, 0);
    
    console.log(`\n=== Data Quality Summary ===`);
    console.log(`Cards with stock: ${cardsWithStock.length}`);
    console.log(`Total stock across all cards: ${totalStock}`);
    console.log(`Average price: €${averagePrice.toFixed(2)}`);
    console.log(`Price range: €${Math.min(...uniqueCards.map(c => c.price)) / 100} - €${Math.max(...uniqueCards.map(c => c.price)) / 100}`);

    // Add metadata
    const output = {
      lastUpdated: new Date().toISOString(),
      totalCards: uniqueCards.length,
      collectionsProcessed: processedCollections,
      dataQuality: {
        cardsWithStock: cardsWithStock.length,
        totalStock: totalStock,
        averagePrice: averagePrice,
        priceRange: {
          min: Math.min(...uniqueCards.map(c => c.price)) / 100,
          max: Math.max(...uniqueCards.map(c => c.price)) / 100
        }
      },
      cards: uniqueCards
    };

    // Save to public directory
    const outputPath = path.join(__dirname, '..', 'public', 'outpost-stock.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`\n=== Scraping Complete ===`);
    console.log(`Duration: ${duration} seconds`);
    console.log(`Collections processed: ${processedCollections}`);
    console.log(`Total cards: ${uniqueCards.length}`);
    console.log(`Output saved to: ${outputPath}`);

    // Log some sample cards
    if (uniqueCards.length > 0) {
      console.log('\nSample cards:');
      uniqueCards.slice(0, 5).forEach((card, i) => {
        console.log(`${i + 1}. ${card.name} - ${card.set} - ${card.stock} in stock - ${card.priceFormatted}`);
      });
    }

  } catch (error) {
    console.error('Error in main scraping function:', error);
  }
}

// Run the scraper
if (require.main === module) {
  scrapeOutpost();
}

module.exports = { scrapeOutpost }; 