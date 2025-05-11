// src/components/fluid/config/fluidConfig.js

/**
 * Default configuration for fluid simulation
 * These values can be overridden when creating a FluidSimulation instance
 */
/**
 * Default configuration for the fluid simulation.
 * @type {Object}
 * @property {number} SIM_RESOLUTION
 * @property {number} DYE_RESOLUTION
 * @property {number} CAPTURE_RESOLUTION
 * @property {number} DENSITY_DISSIPATION
 * @property {number} VELOCITY_DISSIPATION
 * @property {number} PRESSURE
 * @property {number} PRESSURE_ITERATIONS
 * @property {number} CURL
 * @property {number} SPLAT_RADIUS
 * @property {number} SPLAT_FORCE
 * @property {boolean} SHADING
 * @property {number} COLOR_UPDATE_SPEED
 * @property {Array<number>} BACK_COLOR
 * @property {boolean} TRANSPARENT
 */
const defaultFluidConfig = {
  SIM_RESOLUTION: 128, // Match standalone
  DYE_RESOLUTION: 1440, // Match standalone
  CAPTURE_RESOLUTION: 512,
  DENSITY_DISSIPATION: 3.5, // Match standalone for slower dissipation
  VELOCITY_DISSIPATION: 2, // Match standalone
  PRESSURE: 0.1,
  PRESSURE_ITERATIONS: 20,
  CURL: 3, // Match standalone
  SPLAT_RADIUS: 0.2, // Match standalone
  SPLAT_FORCE: 6000, // Match standalone
  SHADING: true,
  COLORFUL: true,
  COLOR_UPDATE_SPEED: 10,
  PAUSED: false,
  BACK_COLOR: { r: 0.5, g: 0, b: 0 }, // Match standalone
  TRANSPARENT: true, // Match standalone
  BLOOM: true, 
  BLOOM_ITERATIONS: 8,
  BLOOM_RESOLUTION: 256,
  BLOOM_INTENSITY: 0.8,
  BLOOM_THRESHOLD: 0.6,
  BLOOM_SOFT_KNEE: 0.7,
  SUNRAYS: true, 
  SUNRAYS_RESOLUTION: 196,
  SUNRAYS_WEIGHT: 1.0,
};

export default defaultFluidConfig;
