const os = require('os');
const { spawn } = require('child_process');

let monitoringInterval = null;
const CPU_THRESHOLD = 70; // 70% threshold


let lastCpuInfo = os.cpus();

function cpuAverage(cpus) {
  let idle = 0;
  let total = 0;

  cpus.forEach(cpu => {
    for (const type in cpu.times) {
      total += cpu.times[type];
    }
    idle += cpu.times.idle;
  });

  return { idle, total };
}


// Calculate CPU usage
async function getCpuUsage() {
  return new Promise(resolve => {
    setTimeout(() => {
      const currentCpuInfo = os.cpus();

      const last = cpuAverage(lastCpuInfo);
      const current = cpuAverage(currentCpuInfo);

      const idleDiff = current.idle - last.idle;
      const totalDiff = current.total - last.total;

      const usage = (1 - idleDiff / totalDiff) * 100;

      lastCpuInfo = currentCpuInfo;

      resolve(usage);
    }, 1000); // 1 second sampling
  });
}

// Store server instance for graceful shutdown
let serverInstance = null;

// Set server instance
function setServerInstance(server) {
  serverInstance = server;
}

// Restart the server
function restartServer() {
  console.log('CPU usage exceeded 70%. Restarting server...');
  
  if (serverInstance) {
    // Close the server first
    serverInstance.close(() => {
      console.log('Server closed, restarting...');
      
      // Get the current process
      const currentScript = process.argv[1];
      
      // Wait a bit for port to be released
      setTimeout(() => {
        // Spawn a new process
        const newProcess = spawn('node', [currentScript], {
          detached: true,
          stdio: 'inherit'
        });
        
        newProcess.unref();
        
        // Exit current process
        setTimeout(() => {
          process.exit(0);
        }, 500);
      }, 2000); // Wait 2 seconds for port to be released
    });
  } else {
    // Fallback if server instance not set
    console.log('Server instance not available, exiting...');
    process.exit(0);
  }
}

// Start CPU monitoring
function startCpuMonitoring(intervalMs = 5000) {
  if (monitoringInterval) {
    console.log('CPU monitoring is already running');
    return;
  }

  console.log(`Starting CPU monitoring (checking every ${intervalMs}ms, threshold: ${CPU_THRESHOLD}%)`);

  monitoringInterval = setInterval(async () => {
    try {
      const cpuUsage = await getCpuUsage();
      console.log(`Current CPU Usage: ${cpuUsage.toFixed(2)}%`);

      if (cpuUsage >= CPU_THRESHOLD) {
        console.warn(`CPU usage (${cpuUsage.toFixed(2)}%) exceeded threshold (${CPU_THRESHOLD}%)`);
        clearInterval(monitoringInterval);
        monitoringInterval = null;
        restartServer();
      }
    } catch (error) {
      console.error('Error monitoring CPU:', error);
    }
  }, intervalMs);
}

// Stop CPU monitoring
function stopCpuMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log('CPU monitoring stopped');
  }
}

module.exports = {
  startCpuMonitoring,
  stopCpuMonitoring,
  getCpuUsage,
  setServerInstance,
  restartServer
};

