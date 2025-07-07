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

// Configuration
const config = {
  maxCardsPerCollection: null,           // No limit - get ALL cards
  delayBetweenRequests: 1000,            // 1 second between requests
  delayBetweenCollections: 1500,         // 1.5 seconds between collections
  batchSize: 25,                         // Save progress every 25 collections
  enableProgressSaving: true,            // Save intermediate results
  resumeFromProgress: true,              // Resume from saved progress
  maxRetries: 3,                         // Retry failed requests
  timeoutMs: 30000,                      // 30 second timeout
  skipEmptyCollections: true,            // Skip collections with 0 cards
  minCardsToProcess: 1,                  // Only process collections with at least 1 card
};

// Function to parse collections from HTML file
function parseCollectionsFromHTML() {
  console.log('Parsing collections from outpost.html...');
  
  const htmlPath = path.join(__dirname, '..', 'outpost.html');
  if (!fs.existsSync(htmlPath)) {
    console.error('outpost.html file not found!');
    return [];
  }
  
  const html = fs.readFileSync(htmlPath, 'utf8');
  const $ = cheerio.load(html);
  
  const collections = [];
  const seen = new Set();
  
  // Extract collections from all sections
  $('.catalog_list_element a').each((index, element) => {
    const href = $(element).attr('href');
    const name = $(element).text().trim();
    
    if (href && name) {
      // Extract collection ID from URL
      const match = href.match(/collectionid=(\d+)/);
      if (match) {
        const collectionId = match[1];
        const key = `${collectionId}-${name}`;
        
        if (!seen.has(key)) {
          seen.add(key);
          collections.push({
            name,
            id: collectionId,
            url: getCollectionUrl(collectionId)
          });
        }
      }
    }
  });
  
  console.log(`Found ${collections.length} unique collections`);
  return collections;
}

// Function to check if collection has cards (quick check)
async function hasCards(collection) {
  try {
    const response = await axios.get(collection.url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    const cardCount = $('.outpost_shop_list_item_mtg').length;
    return cardCount > 0;
  } catch (error) {
    console.log(`⚠️  Error checking ${collection.name}: ${error.message}`);
    return false; // Skip if we can't check
  }
}

// Function to scrape a single collection with retry logic
async function scrapeCollectionWithRetry(collection) {
  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      return await scrapeCollection(collection);
    } catch (error) {
      console.log(`Attempt ${attempt} failed for ${collection.name}: ${error.message}`);
      if (attempt === config.maxRetries) {
        console.log(`⚠️  Failed to scrape ${collection.name} after ${config.maxRetries} attempts`);
        return [];
      }
      await delay(config.delayBetweenRequests * attempt); // Exponential backoff
    }
  }
}

// Parse card data from HTML attributes and condition details (same as main scraper)
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

// Function to scrape a single collection
async function scrapeCollection(collection) {
  console.log(`Scraping collection: ${collection.name} (ID: ${collection.id})`);
  
  const response = await axios.get(collection.url, {
    timeout: config.timeoutMs,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
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
  
  $('.outpost_shop_list_item_mtg').each((index, element) => {
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
}

// Function to save progress
function saveProgress(processedCollections, allCards, collectionsProcessed, skippedCollections) {
  if (!config.enableProgressSaving) return;
  
  const progress = {
    timestamp: new Date().toISOString(),
    collectionsProcessed,
    collectionsSkipped: skippedCollections.length,
    totalCards: allCards.length,
    processedCollectionIds: processedCollections.map(c => c.id),
    skippedCollectionIds: skippedCollections.map(c => c.id),
    cards: allCards
  };
  
  const progressPath = path.join(__dirname, '..', 'scrape-progress.json');
  fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
  console.log(`💾 Progress saved: ${collectionsProcessed} processed, ${skippedCollections.length} skipped, ${allCards.length} cards`);
}

// Function to load progress
function loadProgress() {
  if (!config.resumeFromProgress) return null;
  
  const progressPath = path.join(__dirname, '..', 'scrape-progress.json');
  if (!fs.existsSync(progressPath)) return null;
  
  try {
    const progress = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
    console.log(`📂 Found previous progress: ${progress.collectionsProcessed} processed, ${progress.collectionsSkipped || 0} skipped, ${progress.totalCards} cards`);
    return progress;
  } catch (error) {
    console.log('⚠️  Could not load progress file');
    return null;
  }
}

// Function to consolidate cards - only keep the best available version per card name
function consolidateCards(cards) {
  const uniqueCards = [];
  const cardGroups = new Map();
  
  // Group cards by name only (ignoring set/collection/foil differences)
  for (const card of cards) {
    const cardName = card.name.toLowerCase().trim();
    if (!cardGroups.has(cardName)) {
      cardGroups.set(cardName, []);
    }
    cardGroups.get(cardName).push(card);
  }
  
  // For each card name, find the best available version
  for (const [cardName, cardVariants] of cardGroups) {
    let bestCard = null;
    
    // Priority 1: Cards with stock > 0 and price > 0
    const availableCards = cardVariants.filter(card => card.stock > 0 && card.price > 0);
    
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
      const validPriceCards = cardVariants.filter(card => card.price > 0);
      if (validPriceCards.length > 0) {
        bestCard = validPriceCards.sort((a, b) => a.price - b.price)[0];
      }
    }
    
    if (bestCard) {
      uniqueCards.push(bestCard);
    }
  }
  
  console.log(`Consolidated ${cards.length} card variants into ${uniqueCards.length} unique cards`);
  console.log(`Cards with stock: ${uniqueCards.filter(c => c.stock > 0).length}`);
  console.log(`Cards with valid prices: ${uniqueCards.filter(c => c.price > 0).length}`);
  
  return uniqueCards;
}

// Main scraping function
async function scrapeAllCollections() {
  const startTime = Date.now();
  console.log('🚀 Starting comprehensive Outpost scraping...');
  console.log(`Configuration: No card limit, ${config.delayBetweenCollections}ms delays, skip empty collections`);
  
  try {
    // Parse collections from HTML
    const allCollections = parseCollectionsFromHTML();
    
    if (allCollections.length === 0) {
      console.log('❌ No collections found. Exiting.');
      return;
    }
    
    // Load previous progress if it exists
    const progress = loadProgress();
    let processedCollectionIds = progress ? new Set(progress.processedCollectionIds) : new Set();
    let skippedCollectionIds = progress ? new Set(progress.skippedCollectionIds || []) : new Set();
    let allCards = progress ? progress.cards : [];
    let collectionsProcessed = progress ? progress.collectionsProcessed : 0;
    let skippedCollections = progress ? progress.skippedCollectionIds || [] : [];
    
    // Filter out already processed collections
    const collectionsToProcess = allCollections.filter(c => 
      !processedCollectionIds.has(c.id) && !skippedCollectionIds.has(c.id)
    );
    
    console.log(`📋 Total collections: ${allCollections.length}`);
    console.log(`✅ Already processed: ${allCollections.length - collectionsToProcess.length}`);
    console.log(`🔄 Remaining to process: ${collectionsToProcess.length}`);
    
    // Process collections in batches
    for (let i = 0; i < collectionsToProcess.length; i++) {
      const collection = collectionsToProcess[i];
      const progressPercent = ((i + 1) / collectionsToProcess.length * 100).toFixed(1);
      
      console.log(`\n[${i + 1}/${collectionsToProcess.length}] (${progressPercent}%) Processing: ${collection.name}`);
      
      // Check if collection has cards (if skip empty enabled)
      if (config.skipEmptyCollections) {
        const hasCardCheck = await hasCards(collection);
        if (!hasCardCheck) {
          console.log(`⏩ Skipping ${collection.name} - no cards found`);
          skippedCollections.push(collection);
          skippedCollectionIds.add(collection.id);
          continue;
        }
      }
      
      // Scrape the collection
      const cards = await scrapeCollectionWithRetry(collection);
      
      // Skip if no cards found
      if (cards.length === 0) {
        console.log(`⏩ Skipping ${collection.name} - no cards found`);
        skippedCollections.push(collection);
        skippedCollectionIds.add(collection.id);
      } else {
        allCards = allCards.concat(cards);
        processedCollectionIds.add(collection.id);
        collectionsProcessed++;
        console.log(`✅ Added ${cards.length} cards from ${collection.name}`);
      }
      
      // Rate limiting
      if (i < collectionsToProcess.length - 1) {
        await delay(config.delayBetweenCollections);
      }
      
      // Save progress every batch
      if ((collectionsProcessed + skippedCollections.length) % config.batchSize === 0) {
        saveProgress([...processedCollectionIds].map(id => ({id})), allCards, collectionsProcessed, skippedCollections);
      }
    }
    
    // Consolidate cards - only keep the best available version per card name
    const uniqueCards = consolidateCards(allCards);
    
    console.log(`\n🎯 Scraping Summary:`);
    console.log(`├─ Collections processed: ${collectionsProcessed}`);
    console.log(`├─ Collections skipped: ${skippedCollections.length}`);
    console.log(`├─ Total card variants found: ${allCards.length}`);
    console.log(`├─ Consolidated unique cards: ${uniqueCards.length}`);
    console.log(`└─ Variants consolidated: ${allCards.length - uniqueCards.length}`);
    
    // Create final output
    const output = {
      lastUpdated: new Date().toISOString(),
      totalCards: uniqueCards.length,
      collectionsProcessed: collectionsProcessed,
      collectionsSkipped: skippedCollections.length,
      totalCollections: allCollections.length,
      completionPercentage: ((collectionsProcessed / allCollections.length) * 100).toFixed(1),
      cards: uniqueCards,
      metadata: {
        scrapeConfig: config,
        skippedCollections: skippedCollections.slice(0, 10).map(c => ({ name: c.name, id: c.id })),
        processedCollectionsSample: allCollections.filter(c => processedCollectionIds.has(c.id)).slice(0, 10).map(c => ({ name: c.name, id: c.id }))
      }
    };
    
    // Save final results
    const outputPath = path.join(__dirname, '..', 'public', 'outpost-stock.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    
    // Clean up progress file
    const progressPath = path.join(__dirname, '..', 'scrape-progress.json');
    if (fs.existsSync(progressPath)) {
      fs.unlinkSync(progressPath);
      console.log('🗑️  Progress file cleaned up');
    }
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`\n🎉 === Complete Scraping Finished ===`);
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`📊 Collections: ${collectionsProcessed}/${allCollections.length} (${output.completionPercentage}%)`);
    console.log(`⏩ Skipped: ${skippedCollections.length} empty collections`);
    console.log(`🃏 Total cards: ${uniqueCards.length}`);
    console.log(`💾 Output saved to: ${outputPath}`);
    
    // Show sample cards from different collections
    if (uniqueCards.length > 0) {
      console.log('\n📋 Sample cards from different collections:');
      const sampleCollections = [...new Set(uniqueCards.map(c => c.collection))].slice(0, 5);
      sampleCollections.forEach((collectionName, idx) => {
        const card = uniqueCards.find(c => c.collection === collectionName);
        console.log(`${idx + 1}. ${card.name} (${card.collection}) - ${card.stock} in stock - ${card.priceFormatted}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error in comprehensive scraping:', error);
    
    // Save whatever we have so far
    if (typeof allCards !== 'undefined' && allCards.length > 0) {
      console.log('💾 Saving partial results...');
      const partialOutput = {
        lastUpdated: new Date().toISOString(),
        totalCards: allCards.length,
        collectionsProcessed: collectionsProcessed || 0,
        isPartial: true,
        cards: allCards
      };
      
      const outputPath = path.join(__dirname, '..', 'public', 'outpost-stock.json');
      fs.writeFileSync(outputPath, JSON.stringify(partialOutput, null, 2));
    }
  }
}

// Run the scraper
if (require.main === module) {
  scrapeAllCollections();
}

module.exports = { scrapeAllCollections }; 