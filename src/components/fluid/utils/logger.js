// src/components/fluid/utils/logger.js

/**
 * Simple logger utility for the fluid simulation
 */
const logger = {
  log: (...args) => {
    console.log('[Fluid]', ...args);
  },
  
  error: (...args) => {
    console.error('[Fluid ERROR]', ...args);
  },
  
  warn: (...args) => {
    console.warn('[Fluid WARNING]', ...args);
  },
  
  info: (...args) => {
    console.info('[Fluid INFO]', ...args);
  }
};

export default logger;
