# 🎵 It's My Turn - Development Environment
# Node.js 20 LTS with Alpine for lightweight image
FROM node:20-alpine

# Install essential tools
RUN apk add --no-cache git curl bash

# Set working directory
WORKDIR /app

# Copy package files first (for Docker layer caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Expose Vite dev server port
EXPOSE 3000

# Expose Supabase local ports (if needed)
EXPOSE 54321 54322 54323 54324

# Development command
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

