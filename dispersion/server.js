const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
require('dotenv').config();

// Import routes
const weatherRoutes = require('./src/routes/weather');
const chemicalRoutes = require('./src/routes/chemicals');
const dispersionRoutes = require('./src/routes/dispersion');
const receptorRoutes = require('./src/routes/receptors');
const gisRoutes = require('./src/routes/gis');

// Import services
const DatabaseService = require('./src/services/DatabaseService');
const WeatherService = require('./src/services/WeatherService');
const DispersionService = require('./src/services/DispersionService');

const app = express();
const server = http.createServer(app);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "wss:", "https:"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Middleware
app.use(compression());
app.use(morgan('combined'));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, 'client')));

// API Routes
app.use('/api/weather', weatherRoutes);
app.use('/api/chemicals', chemicalRoutes);
app.use('/api/receptors', receptorRoutes);
app.use('/api/gis', gisRoutes);

// WebSocket setup for real-time updates
const wss = new WebSocket.Server({ 
  server,
  path: '/ws'
});

// Pass WebSocket server to dispersion routes
app.use('/api/dispersion', (req, res, next) => {
  req.wss = wss;
  next();
}, dispersionRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Serve the main application
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection established');
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received WebSocket message:', data.type);
      
      switch (data.type) {
        case 'subscribe':
          // Handle client subscription to update types
          ws.subscriptions = data.payload.types || [];
          console.log('Client subscribed to:', ws.subscriptions);
          break;
        case 'subscribe_dispersion':
          ws.dispersionId = data.dispersionId;
          break;
        case 'subscribe_weather':
          ws.weatherLocation = data.location;
          break;
        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Initialize services and start server
async function startServer() {
  try {
    // Initialize database connection
    await DatabaseService.connect();
    console.log('Database connected successfully');
    
    // Initialize weather service
    const weatherService = new WeatherService();
    weatherService.startPeriodicUpdates();
    console.log('Weather service initialized');
    
    // Initialize dispersion service
    const dispersionService = new DispersionService(wss);
    // Pass the dispersion service to the routes
    dispersionRoutes.setDispersionService && dispersionRoutes.setDispersionService(dispersionService);
    dispersionService.startRealTimeUpdates();
    console.log('Dispersion service initialized');
    
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log(`Chemical Dispersion Modeler server running on port ${PORT}`);
      console.log(`WebSocket server available at ws://localhost:${PORT}/ws`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(async () => {
    await DatabaseService.disconnect();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(async () => {
    await DatabaseService.disconnect();
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();