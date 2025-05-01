FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy application code
COPY . .

# Make scripts executable
RUN chmod +x ./scripts/*.js

EXPOSE 3001

# Use custom entrypoint script to handle database seeding
CMD ["node", "scripts/docker-entrypoint.js"] 