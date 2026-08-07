# Use Node.js LTS (Alpine for smaller image size)
FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --production

# Copy source code
COPY server/ ./server/
COPY public/ ./public/

# Expose port (Cloud Run sets process.env.PORT, often defaults to 8080)
EXPOSE 8080

# Start the Node.js server
CMD ["node", "server/index.js"]
