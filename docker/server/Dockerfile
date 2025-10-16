# Build stage
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Copy go mod files
COPY src/server/go.mod src/server/go.sum ./
RUN go mod download

# Copy source code
COPY src/server/ ./

# Build the application (Pure Go - no CGO needed)
RUN CGO_ENABLED=0 GOOS=linux go build -a -ldflags='-w -s' -o server ./cmd/server

# Final stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy the binary from builder
COPY --from=builder /app/server .

RUN chmod +x /root/server

# Create data directory
RUN mkdir -p /root/data

# Expose port
EXPOSE 8080

# Run the binary
CMD ["./server"]

