// src/components/fluid/config/fluidConfig.js

/**
 * Default configuration for fluid simulation
 * These values can be overridden when creating a FluidSimulation instance
 */
const defaultFluidConfig = {
  SIM_RESOLUTION: 256, // Higher resolution for more detailed simulation
  DYE_RESOLUTION: 1024, // Closer to SIM_RESOLUTION for better visual quality
  CAPTURE_RESOLUTION: 512,
  DENSITY_DISSIPATION: 0.92, // Much faster dissipation to prevent dye buildup
  VELOCITY_DISSIPATION: 0.94, // Faster dissipation for velocity
  PRESSURE: 0.1,
  PRESSURE_ITERATIONS: 20,
  CURL: 50, // Higher curl value for more pronounced vorticity effects
  SPLAT_RADIUS: 0.005, // Slightly smaller splats
  SPLAT_FORCE: 800, // Reduced force for more controlled velocity
  SHADING: true,
  COLORFUL: true,
  COLOR_UPDATE_SPEED: 10,
  PAUSED: false,
  BACK_COLOR: { r: 0.0, g: 0.0, b: 0.0 }, // Black background
  TRANSPARENT: false, // Disable transparency to see background
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
