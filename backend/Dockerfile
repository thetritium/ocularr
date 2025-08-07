FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy application files
COPY . .

# Create uploads directory structure
RUN mkdir -p uploads/clubs uploads/profiles

# Expose port
EXPOSE 3001

# Start the application
CMD ["node", "server.js"]