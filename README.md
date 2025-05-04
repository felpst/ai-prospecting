# AI-Prospecting B2B Sales Intelligence Platform

This platform helps sales professionals identify and research potential B2B customers using AI-powered insights.

## Quick Start

```bash
# Clone the repository
git clone https://github.com/felpst/ai-prospecting.git
cd ai-prospecting

# Run the setup script to prepare the dataset
npm run setup

# Start with Docker Compose
docker-compose up
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api

## Large-Scale Data Import

The system is designed to automatically import and process 100,000 company records from the company dataset on startup. This happens automatically when you run `docker-compose up` for the first time.

### Import Process

1. When the backend container starts, it checks if data already exists in the database
2. If no data exists, it automatically imports 100,000 companies from the included dataset
3. The import process is optimized to handle large datasets efficiently:
   - Memory-efficient chunked processing
   - Batch database operations
   - Adaptive memory allocation based on dataset size
   - Index optimization during import

### Import Configuration

The import is pre-configured for optimal performance, but you can adjust settings by modifying these files:
- `backend/scripts/optimizedImport.js`: Main import script with tunable parameters
- `backend/scripts/docker-entrypoint.js`: Controls startup behavior
- `docker-compose.yml`: Container resource allocation

### Resource Requirements

For optimal performance when importing the full dataset:
- At least 8GB of RAM available for Docker
- About 5GB of disk space

### Manual Import Options

If you need to manually import data or adjust the import size:

```bash
# Import 100,000 companies (default)
cd backend
node --max-old-space-size=8192 scripts/optimizedImport.js

# Import with custom parameters
node --max-old-space-size=8192 scripts/optimizedImport.js --total=50000 --chunk=5000 --batch=10 --clear
```

## Features

- **Advanced Search Interface**: Filter companies by industry, size, location, founding year
- **Data Visualization**: View company metrics and analytics
- **Responsive Design**: Works on desktop and mobile devices
- **Large Dataset Support**: Efficiently handles 100,000+ company records
- **Real-time Filtering**: Instant results as you adjust search criteria

## Tech Stack

- **Frontend**: React with TypeScript, Vite, Tailwind CSS
- **Backend**: Node.js, Express
- **Database**: MongoDB
- **Containerization**: Docker, Docker Compose
- **Performance**: Optimized data processing for large datasets

## Development

```bash
# Start in development mode
docker-compose up

# Run backend tests
cd backend && npm test

# Run frontend tests
cd frontend && npm test
```
