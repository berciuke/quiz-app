# Multi-stage build for production optimization
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache openssl libc6-compat

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci && npm cache clean --force

# Generate Prisma client
RUN npx prisma generate

# Production stage
FROM node:18-alpine AS runner

# Install runtime dependencies
RUN apk add --no-cache curl openssl

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodeuser

# Set working directory
WORKDIR /app

# Copy dependencies from builder stage
COPY --from=builder --chown=nodeuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodeuser:nodejs /app/prisma ./prisma

# Copy application code
COPY --chown=nodeuser:nodejs src ./src
COPY --chown=nodeuser:nodejs package*.json ./

# Switch to non-root user
USER nodeuser

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

# Start application
CMD ["npm", "start"] 