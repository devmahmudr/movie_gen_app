# Use Node.js 20 LTS (matches .nvmrc and avoids compatibility issues)
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install pnpm (optional, but faster) or use npm
# You can switch to npm if preferred
RUN npm install -g npm@latest

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Default command (can be overridden in docker-compose)
CMD ["npm", "run", "start:dev"]

