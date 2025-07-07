# Outpost Gaming MTG Inventory Checker

A Next.js application that helps you check card availability from **Outpost Gaming Belgium** (outpost.be) against your Moxfield deck lists.

## Features

- **Import Moxfield Decks**: Paste a Moxfield deck URL to analyze card availability
- **Live Inventory Check**: See which cards are in stock at Outpost Gaming Belgium
- **Availability Overview**: Get percentage breakdowns of available cards and total cost
- **Card Details**: View individual card availability, stock quantities, and prices
- **Inventory Search**: Browse and search the entire Outpost inventory
- **Real-time Data**: Scraper pulls live data from the Outpost website

## Live Demo

The application is designed to work with real data from Outpost Gaming Belgium.

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd outpost-gaming-checker
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser**:
   Navigate to `http://localhost:3000`

## Usage

### Analyzing a Moxfield Deck

1. Go to your Moxfield deck page
2. Copy the deck URL (e.g., `https://www.moxfield.com/decks/abc123`)
3. Paste the URL into the input field on the app
4. Click "Analyze Deck"
5. View the availability report showing:
   - Total cards available vs. total cards needed
   - Percentage breakdown
   - Total cost of available cards
   - Individual card details with stock and prices

### Browsing Inventory

1. Click on the "Card Search" tab
2. Search for specific cards using the search box
3. Sort by name, price, or quantity
4. Filter to show only available cards
5. View detailed information for each card

## Data Structure

The app uses real data from Outpost Gaming Belgium with the following structure:

### Card Data
Each card includes:
- **name**: Card name
- **price**: Price in euro cents
- **stock**: Available quantity
- **rarity**: Card rarity (M=Mythic, R=Rare, U=Uncommon, C=Common)
- **foil**: Whether the card is foil
- **colors**: Color identity (white, blue, black, red, green, colorless)
- **collection**: Set/collection name
- **collectionId**: Outpost's internal collection ID

### Collections Available
The scraper can access hundreds of collections including:
- **Standard Sets**: Latest MTG releases (Foundations, Duskmourn, Bloomburrow, etc.)
- **Commander**: All Commander products and decks
- **Universes Beyond**: Final Fantasy, Assassin's Creed, Doctor Who, etc.
- **Masters Series**: Double Masters, Ultimate Masters, etc.
- **Secret Lair**: Special releases and drops
- **Promos**: Tournament promos and special editions
- **Historical Sets**: From Alpha through current sets

## Real Data Scraping

The application includes a working scraper that pulls live data from Outpost Gaming Belgium:

```bash
# Run the scraper to update inventory
node scripts/scrape-outpost.js
```

### Scraper Features
- **Collection Discovery**: Automatically finds all available collections
- **Priority Scraping**: Focuses on popular/recent sets first
- **Rate Limiting**: Respectful scraping with delays between requests
- **Duplicate Handling**: Removes duplicate cards across collections
- **Error Handling**: Gracefully handles network issues and parsing errors

### Data Coverage
The scraper currently processes:
- **10 priority collections** per run (to avoid overwhelming the server)
- **100 cards per collection** maximum
- **697 total collections** available on the site
- **Real-time stock** and pricing information

## Outpost Website Structure

The application works with the actual Outpost Gaming Belgium website structure:

### URLs
- **Catalog**: `https://www.outpost.be/website/index.php?option=com_outpostshop&view=catalog&catalogid=1&Itemid=4`
- **Collections**: `https://www.outpost.be/website/index.php?option=com_outpostshop&Itemid=4&view=productlist&catalogid=1&collectionid=XXXXXXXXX`

### HTML Structure
- **Cards**: `.outpost_shop_list_item_mtg` containers
- **Attributes**: Card data stored in HTML attributes (`elnm`, `price`, `stock`, `magicrarity`, etc.)
- **Categories**: Organized by collection type and set release

## Development

### File Structure
```
├── components/
│   ├── CardSearch.tsx      # Inventory search component
│   ├── DeckAnalysis.tsx    # Deck analysis display
│   └── LoadingSpinner.tsx  # Loading indicator
├── lib/
│   ├── store.ts           # Zustand state management
│   ├── types.ts           # TypeScript interfaces
│   └── utils.ts           # Utility functions
├── pages/
│   ├── _app.tsx           # App initialization
│   └── index.tsx          # Main page
├── public/
│   └── outpost-stock.json # Current inventory data
├── scripts/
│   └── scrape-outpost.js  # Live data scraper
└── styles/
    └── globals.css        # Global styles
```

### Adding New Features

1. **Update Types**: Add new interfaces in `lib/types.ts`
2. **Extend Store**: Add new actions in `lib/store.ts`
3. **Create Components**: Add new components in `components/`
4. **Update Scraper**: Modify `scripts/scrape-outpost.js` for new data

### Customization

- **Collections**: Modify `priorityCollections` in the scraper to focus on different sets
- **Limits**: Adjust `maxCollections` and `maxCards` in the scraper
- **Styling**: Update `tailwind.config.js` and component styles
- **Search**: Enhance fuzzy search in `lib/utils.ts`

## Deployment

The application is ready for deployment on platforms like Vercel, Netlify, or any Node.js hosting:

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Set up data updates**:
   - Run the scraper periodically (e.g., daily cron job)
   - Update the `outpost-stock.json` file
   - Alternatively, integrate the scraper as an API endpoint

3. **Deploy**: Follow your platform's deployment guide

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with real data
5. Submit a pull request

## Legal Notice

This application is for educational and personal use only. Please respect Outpost Gaming Belgium's terms of service and robots.txt when using the scraper. The scraper includes rate limiting and other measures to be respectful to their servers.

## Support

For issues or questions:
1. Check the console for error messages
2. Verify the Outpost website structure hasn't changed
3. Test the scraper with `node scripts/scrape-outpost.js`
4. Create an issue with details about the problem

---

**Note**: This application works with real data from Outpost Gaming Belgium. Stock levels and prices are updated when the scraper runs and reflect actual availability at the time of scraping. 