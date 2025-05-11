// src/components/fluid/utils/logger.js

/**
 * Simple logger utility for the fluid simulation
 */
const logger = {
  /**
   * Logs a message to the console with a [Fluid] prefix.
   * @param {...any} args - Arguments to log
   */
  log: (...args) => {
    console.log('[Fluid]', ...args);
  },
  
  /**
   * Logs an error message to the console with a [Fluid ERROR] prefix.
   * @param {...any} args - Arguments to log
   */
  error: (...args) => {
    console.error('[Fluid ERROR]', ...args);
  },
  
  /**
   * Logs a warning message to the console with a [Fluid WARNING] prefix.
   * @param {...any} args - Arguments to log
   */
  warn: (...args) => {
    console.warn('[Fluid WARNING]', ...args);
  },
  
  /**
   * Logs an informational message to the console with a [Fluid INFO] prefix.
   * @param {...any} args - Arguments to log
   */
  info: (...args) => {
    console.info('[Fluid INFO]', ...args);
  }
};

export default logger;
