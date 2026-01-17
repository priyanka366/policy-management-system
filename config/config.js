module.exports = {
  port: process.env.PORT || 3000,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/policy_management',
  nodeEnv: process.env.NODE_ENV || 'development',
  cpuThreshold: 70, // CPU usage threshold in percentage
  cpuCheckInterval: 5000 // Check CPU every 5 seconds
};

