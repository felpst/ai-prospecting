# AI-Prospecting

A B2B sales intelligence platform that enables sales teams to discover, research, and save high-potential companies using rich filters and AI-powered enrichment.

## Overview

AI-Prospecting allows sales teams to search through a comprehensive company dataset, generate AI-enriched company summaries, and manage prospect lists for effective sales outreach.

## Features

- **Company Search and Discovery**: Filter companies based on structured data with pagination support. AI-powered free-text search capabilities.
- **AI-Powered Company Enrichment**: Generate insightful summaries of companies by scraping their landing pages and using LLM technology.
- **CRM-Style Prospect Management**: Save promising companies to a list and manage them through a dedicated dashboard.
- **Advanced AI Discovery**: Support for complex natural language search queries using external search engines (bonus feature).

## Tech Stack

- **Frontend**: React
- **Backend**: Node.js with Express
- **Database**: MongoDB
- **AI**: OpenAI/Anthropic APIs
- **Scraping**: Puppeteer/Playwright

## Getting Started

### Prerequisites

- Node.js (v16+)
- MongoDB
- API keys for OpenAI or Anthropic

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/ai-prospecting.git
   cd ai-prospecting
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   MONGODB_URI=your_mongodb_connection_string
   OPENAI_API_KEY=your_openai_api_key
   # or
   ANTHROPIC_API_KEY=your_anthropic_api_key
   PORT=3000
   ```

4. Start the development servers
   ```bash
   npm start
   ```

## Project Structure

```
ai-prospecting/
├── frontend/             # React frontend application
│   ├── public/           # Static files
│   ├── src/              # Source code
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Page components
│   │   ├── services/     # API service functions
│   │   ├── utils/        # Helper functions
│   │   └── App.tsx       # Main application component
│   └── package.json      # Frontend dependencies
├── backend/              # Node.js backend application
│   ├── src/              # Source code
│   │   ├── controllers/  # Request handlers
│   │   ├── models/       # Database models
│   │   ├── routes/       # API routes
│   │   ├── services/     # Business logic
│   │   ├── utils/        # Helper functions
│   │   └── app.js        # Express application setup
│   └── package.json      # Backend dependencies
├── scripts/              # Utility scripts
├── .env                  # Environment variables
├── .gitignore            # Git ignore file
├── docker-compose.yml    # Docker configuration
└── package.json          # Root package.json for monorepo
```

## License

This project is licensed under the MIT License. 