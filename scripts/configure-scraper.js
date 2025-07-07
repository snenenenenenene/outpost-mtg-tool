#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration options
const CONFIG_OPTIONS = {
  // Collection limits
  maxCollections: {
    description: 'Maximum number of collections to process per run',
    current: 10,
    min: 1,
    max: 50,
    type: 'number'
  },
  
  maxCardsPerCollection: {
    description: 'Maximum number of cards to fetch per collection',
    current: 100,
    min: 10,
    max: 500,
    type: 'number'
  },
  
  // Rate limiting
  delayBetweenRequests: {
    description: 'Delay between requests in milliseconds',
    current: 1000,
    min: 500,
    max: 5000,
    type: 'number'
  },
  
  // Priority collections (can be modified)
  priorityCollections: {
    description: 'Collection names to prioritize (comma-separated)',
    current: [
      'Foundations',
      'Duskmourn',
      'Bloomburrow',
      'Modern Horizons 3',
      'Commander Masters',
      'The Lord of the Rings',
      'March of the Machine',
      'Phyrexia: All Will Be One',
      'Dominaria United',
      'Streets of New Capenna'
    ],
    type: 'array'
  },
  
  // Output options
  outputFormat: {
    description: 'Output format (json or pretty-json)',
    current: 'json',
    options: ['json', 'pretty-json'],
    type: 'choice'
  },
  
  includeDetailUrls: {
    description: 'Include detail URLs for each card',
    current: true,
    type: 'boolean'
  }
};

// Helper functions
function showCurrentConfig() {
  console.log('\n🔧 Current Scraper Configuration:\n');
  
  Object.entries(CONFIG_OPTIONS).forEach(([key, config]) => {
    console.log(`📋 ${key}:`);
    console.log(`   Description: ${config.description}`);
    console.log(`   Current: ${Array.isArray(config.current) ? config.current.join(', ') : config.current}`);
    
    if (config.type === 'number') {
      console.log(`   Range: ${config.min} - ${config.max}`);
    } else if (config.type === 'choice') {
      console.log(`   Options: ${config.options.join(', ')}`);
    }
    console.log('');
  });
}

function updateScraperScript(updates) {
  const scraperPath = path.join(__dirname, 'scrape-outpost.js');
  
  if (!fs.existsSync(scraperPath)) {
    console.error('❌ scrape-outpost.js not found!');
    return false;
  }
  
  let content = fs.readFileSync(scraperPath, 'utf8');
  
  // Update configuration values
  Object.entries(updates).forEach(([key, value]) => {
    switch (key) {
      case 'maxCollections':
        content = content.replace(/const MAX_COLLECTIONS = \d+;/, `const MAX_COLLECTIONS = ${value};`);
        break;
      case 'maxCardsPerCollection':
        content = content.replace(/const MAX_CARDS_PER_COLLECTION = \d+;/, `const MAX_CARDS_PER_COLLECTION = ${value};`);
        break;
      case 'delayBetweenRequests':
        content = content.replace(/const DELAY_BETWEEN_REQUESTS = \d+;/, `const DELAY_BETWEEN_REQUESTS = ${value};`);
        break;
      case 'priorityCollections':
        const priorityArray = Array.isArray(value) ? value : value.split(',').map(s => s.trim());
        const priorityString = priorityArray.map(s => `  '${s}'`).join(',\n');
        content = content.replace(
          /const PRIORITY_COLLECTIONS = \[[\s\S]*?\];/,
          `const PRIORITY_COLLECTIONS = [\n${priorityString}\n];`
        );
        break;
      case 'outputFormat':
        const spaces = value === 'pretty-json' ? 2 : 0;
        content = content.replace(/JSON\.stringify\(.*?, null, \d+\)/, `JSON.stringify(scrapedData, null, ${spaces})`);
        break;
      case 'includeDetailUrls':
        content = content.replace(/const INCLUDE_DETAIL_URLS = (true|false);/, `const INCLUDE_DETAIL_URLS = ${value};`);
        break;
    }
  });
  
  fs.writeFileSync(scraperPath, content);
  console.log('✅ Scraper configuration updated successfully!');
  return true;
}

function showHelp() {
  console.log(`
🚀 Outpost Scraper Configuration Tool

Usage:
  node scripts/configure-scraper.js [command] [options]

Commands:
  show                    Show current configuration
  update <key> <value>    Update a configuration value
  expand-coverage         Increase collection coverage
  reset                   Reset to default configuration
  help                    Show this help message

Examples:
  # Show current config
  node scripts/configure-scraper.js show

  # Increase collection limit
  node scripts/configure-scraper.js update maxCollections 20

  # Add priority collections
  node scripts/configure-scraper.js update priorityCollections "Foundations,Duskmourn,Bloomburrow,Modern Horizons 3"

  # Expand coverage (increases limits)
  node scripts/configure-scraper.js expand-coverage

  # Reset to defaults
  node scripts/configure-scraper.js reset
`);
}

function expandCoverage() {
  console.log('🚀 Expanding collection coverage...\n');
  
  const updates = {
    maxCollections: Math.min(CONFIG_OPTIONS.maxCollections.current * 2, CONFIG_OPTIONS.maxCollections.max),
    maxCardsPerCollection: Math.min(CONFIG_OPTIONS.maxCardsPerCollection.current * 2, CONFIG_OPTIONS.maxCardsPerCollection.max),
    delayBetweenRequests: Math.max(CONFIG_OPTIONS.delayBetweenRequests.current * 1.5, CONFIG_OPTIONS.delayBetweenRequests.min)
  };
  
  console.log('📈 New limits:');
  console.log(`   Max Collections: ${CONFIG_OPTIONS.maxCollections.current} → ${updates.maxCollections}`);
  console.log(`   Max Cards per Collection: ${CONFIG_OPTIONS.maxCardsPerCollection.current} → ${updates.maxCardsPerCollection}`);
  console.log(`   Delay between requests: ${CONFIG_OPTIONS.delayBetweenRequests.current}ms → ${updates.delayBetweenRequests}ms`);
  
  if (updateScraperScript(updates)) {
    console.log('\n✅ Configuration updated! Run the scraper again to collect more data.');
    console.log('⚠️  Note: Higher limits may take longer and use more resources.');
  }
}

function resetConfig() {
  console.log('🔄 Resetting configuration to defaults...\n');
  
  const defaults = {
    maxCollections: 10,
    maxCardsPerCollection: 100,
    delayBetweenRequests: 1000,
    priorityCollections: CONFIG_OPTIONS.priorityCollections.current,
    outputFormat: 'json',
    includeDetailUrls: true
  };
  
  if (updateScraperScript(defaults)) {
    console.log('✅ Configuration reset to defaults!');
  }
}

// Main execution
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'show':
    showCurrentConfig();
    break;
    
  case 'update':
    const key = args[1];
    const value = args[2];
    
    if (!key || !value) {
      console.error('❌ Usage: node configure-scraper.js update <key> <value>');
      process.exit(1);
    }
    
    if (!CONFIG_OPTIONS[key]) {
      console.error(`❌ Unknown configuration key: ${key}`);
      console.log('Available keys:', Object.keys(CONFIG_OPTIONS).join(', '));
      process.exit(1);
    }
    
    const config = CONFIG_OPTIONS[key];
    let processedValue = value;
    
    if (config.type === 'number') {
      processedValue = parseInt(value);
      if (isNaN(processedValue) || processedValue < config.min || processedValue > config.max) {
        console.error(`❌ Value must be a number between ${config.min} and ${config.max}`);
        process.exit(1);
      }
    } else if (config.type === 'boolean') {
      processedValue = value.toLowerCase() === 'true';
    } else if (config.type === 'choice') {
      if (!config.options.includes(value)) {
        console.error(`❌ Value must be one of: ${config.options.join(', ')}`);
        process.exit(1);
      }
    }
    
    updateScraperScript({ [key]: processedValue });
    break;
    
  case 'expand-coverage':
    expandCoverage();
    break;
    
  case 'reset':
    resetConfig();
    break;
    
  case 'help':
  default:
    showHelp();
    break;
} 