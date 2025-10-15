# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY src/app/package*.json ./
RUN npm ci

# Copy source code
COPY src/app/ ./

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install production dependencies only
COPY src/app/package*.json ./
RUN npm ci --omit=dev

# Copy built assets from builder
COPY --from=builder /app/dist ./dist

# Copy proxy server
COPY src/app/server.js ./

# Set default environment variables
ENV PORT=80
ENV API_SERVER=http://server:8080
ENV NODE_ENV=production

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:80', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the proxy server
CMD ["npm", "start"]
