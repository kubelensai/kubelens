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
FROM nginx:alpine

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

