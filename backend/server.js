const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const clubRoutes = require('./routes/clubs');
const cycleRoutes = require('./routes/cycles');
const tmdbRoutes = require('./routes/tmdb');

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Create upload directories if they don't exist
const uploadDirs = [
  path.join(__dirname, 'uploads'),
  path.join(__dirname, 'uploads/profiles'),
  path.join(__dirname, 'uploads/clubs')
];

uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// Middleware
app.use(helmet());

// Updated CORS configuration for Docker environment
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [
        `http://localhost:${process.env.APP_PORT}`,
        `http://127.0.0.1:${process.env.APP_PORT}`,
        process.env.FRONTEND_URL,
        // Allow any IP address with the app port for Docker/NAS environments
        new RegExp(`^http:\\/\\/\\d+\\.\\d+\\.\\d+\\.\\d+:${process.env.APP_PORT}$`),
        // Allow local network ranges
        /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
        /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,
        /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+:\d+$/
      ]
    : [
        'http://localhost:3000', 
        `http://localhost:${process.env.APP_PORT || 5000}`,
        'http://127.0.0.1:3000',
        `http://127.0.0.1:${process.env.APP_PORT || 5000}`
      ],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clubs', clubRoutes);
app.use('/api/cycles', cycleRoutes);
app.use('/api/tmdb', tmdbRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    uploadDirs: uploadDirs.map(dir => ({
      path: dir,
      exists: fs.existsSync(dir)
    }))
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'File too large' });
  }
  
  if (err.message === 'Only image files are allowed') {
    return res.status(400).json({ error: 'Only image files are allowed' });
  }
  
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Ocularr backend server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Upload directories initialized: ${uploadDirs.length}`);
});