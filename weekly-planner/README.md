# Weekly Planner

A modular weekly planning app for meals, activities, chores, and shopping lists.

## Features

- **Meal Planning**: Create meal bundles with ingredients, assign to days of the week
- **Shopping Lists**: Auto-generate shopping lists from selected meals
- **Activities**: Track recurring weekly activities (gym, yoga, etc.)
- **Chores**: Manage weekly household tasks
- **Store Integration**: Link items to store URLs for easy shopping
- **Filtering**: Search and filter through meals and items

## Getting Started

### Prerequisites

- Python 3.x (for the development server)
- Modern web browser with ES modules support

### Running Locally

1. Clone this repository
2. Start the development server:
   ```bash
   python3 server.py
   ```
3. Open http://localhost:8080 in your browser

## Project Structure

```
weekly-planner/
├── app.js              # Main entry point (ES modules)
├── index.html          # Main HTML file
├── styles.css          # Styling
├── server.py           # Development server with CORS support
├── modules/            # ES modules
│   ├── api.js          # API endpoints and data fetching
│   ├── store.js        # State management
│   ├── utils.js        # Utility functions
│   ├── items.js        # Item management
│   ├── bundles.js      # Meal/bundle management
│   ├── shopping.js     # Shopping list functionality
│   ├── weekly.js       # Weekly plan rendering
│   ├── activities.js   # Activity management
│   ├── chores.js       # Chore management
│   └── modal.js        # Modal dialogs
├── data/               # JSON data files
│   ├── items.json      # Individual items/ingredients
│   ├── bundles.json    # Meal bundles
│   ├── activities.json # Weekly activities
│   ├── chores.json     # Weekly chores
│   ├── shopping.json   # Current shopping list
│   └── stores.json     # Store definitions
└── extensions/         # Browser extensions
    └── tesco/          # Tesco integration
```

## Data Model

### Items
Individual ingredients/products with:
- Name, category, unit
- Store sources with URLs

### Bundles (Meals)
Collections of items with quantities:
- Name, type (meal)
- Recipe URL
- List of items with quantities

### Activities & Chores
Weekly recurring tasks:
- Name
- Days of the week

## Customization

1. Edit `data/stores.json` to add your preferred stores
2. Add your own items to `data/items.json`
3. Create meal bundles in `data/bundles.json`
4. Set up activities and chores for your schedule

## Browser Extensions

The `extensions/` folder contains browser extensions for store integrations:
- `tesco/` - Add items directly to Tesco basket

## License

MIT
