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

# Install envsubst for environment variable substitution
RUN apk add --no-cache gettext

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration template
COPY docker/app/nginx.conf /etc/nginx/templates/default.conf.template

# Copy entrypoint script
COPY docker/app/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Set default API_SERVER (can be overridden)
ENV API_SERVER=http://server:8080

# Expose port
EXPOSE 80

# Use custom entrypoint
ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
