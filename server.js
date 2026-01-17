require('dotenv').config();
const express = require('express');
const connectDB = require('./config/database');
const policyRoutes = require('./routes/policyRoutes');
const scheduledMessageRoutes = require('./routes/schedule');
const { startCpuMonitoring, setServerInstance } = require('./utils/cpuMonitor');

const app = express();
const PORT = process.env.PORT || 3000;

// connect to db
connectDB();

// middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// routes
app.use('/api/policy', policyRoutes);
app.use('/api/message', scheduledMessageRoutes);

// root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Policy Management System API',
    version: '1.0.0',
    endpoints: {
      upload: 'POST /api/policy/upload',
      search: 'GET /api/policy/search?username=John',
      aggregate: 'GET /api/policy/aggregate',
      scheduleMessage: 'POST /api/message/schedule-message',
    }
  });
});

// error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// start server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  setServerInstance(server);
  startCpuMonitoring(500); // TODO: maybe increase this interval later
});

// shutdown server
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  server.close(() => {
    process.exit(0);
  });
});

module.exports = app;

