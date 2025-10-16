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

# Create non-root user (matching Helm chart UID 1000)
# Note: node:alpine already has a 'node' user with UID 1000
# We'll use that user instead of creating a new one
RUN deluser --remove-home node 2>/dev/null || true && \
    addgroup -g 1000 kubelens && \
    adduser -D -u 1000 -G kubelens kubelens

WORKDIR /app

# Install production dependencies only
COPY src/app/package*.json ./
RUN npm ci --omit=dev

# Copy built assets from builder
COPY --from=builder /app/dist ./dist

# Copy proxy server
COPY src/app/server.js ./

# Change ownership to non-root user
RUN chown -R kubelens:kubelens /app

# Switch to non-root user
USER kubelens

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
