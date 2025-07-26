const express = require('express');
const cors = require('cors');
require('dotenv').config();
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');
const mapsRoutes = require('./routes/maps');
const themesRoutes = require('./routes/themes');
const http = require('http');
const WebSocket = require('ws');

const app = express();

// Increase body size limit to 5MB (or higher if needed)
app.use(express.json({ limit: '3mb' }));
app.use(express.urlencoded({ limit: '3mb', extended: true }));


// CORS setup
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',  // Local React frontend
      'http://localhost:3001',  // Alternative local port
      'http://localhost:5000',  // Local backend (if needed)
      process.env.FRONTEND_URL, // Environment variable
      'https://pathixfrontend.vercel.app', // Production frontend
      'https://specifies-heather-container-pool.trycloudflare.com'
    ];
    
    // Allow Vercel preview deployments
    if (origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      console.log('CORS allowed origin:', origin);
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle preflight requests

app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

app.get('/', (req, res) => {
  res.send('API is running');
});

app.use('/api/auth', authRoutes);
app.use('/api/maps', mapsRoutes);
app.use('/api/themes', themesRoutes);

// Create HTTP server and attach WebSocket server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', function connection(ws) {
  console.log('Client connected');
  ws.on('message', function incoming(message) {
    console.log('received: %s', message);
    ws.send(`Echo: ${message}`);
  });
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} (and ws://localhost:${PORT}/ws)`);
}); 