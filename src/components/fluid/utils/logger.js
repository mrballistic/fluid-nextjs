// Simple logger utility that can write to a file or console
class Logger {
  constructor() {
    this.logs = [];
    this.enabled = true;
    this.maxLogs = 1000; // Limit the number of logs to prevent memory issues
  }

  log(...args) {
    if (!this.enabled) return;
    
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
    
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    
    // Add to in-memory log
    this.logs.push(logEntry);
    
    // Trim logs if they exceed the maximum
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    
    // Also log to console for immediate feedback
    console.log(...args);
  }

  error(...args) {
    if (!this.enabled) return;
    
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
    
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ERROR: ${message}`;
    
    // Add to in-memory log
    this.logs.push(logEntry);
    
    // Trim logs if they exceed the maximum
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    
    // Also log to console for immediate feedback
    console.error(...args);
  }

  // Download logs as a file
  downloadLogs() {
    const logText = this.logs.join('\n');
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `fluid-logs-${new Date().toISOString().replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Clear logs
  clear() {
    this.logs = [];
  }

  // Enable/disable logging
  setEnabled(enabled) {
    this.enabled = enabled;
  }
}

// Create a singleton instance
const logger = new Logger();

export default logger;
