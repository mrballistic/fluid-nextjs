// src/components/fluid/FluidSimulation.js
import WebGLContextManager from './webgl/WebGLContextManager.js';
import { Program, Material, compileShader } from './webgl/ShaderManager.js';
import { createFBO, createDoubleFBO, resizeFBO, resizeDoubleFBO } from './webgl/FramebufferManager.js';
import { getResolution } from './utils.js';
import * as shaders from './webgl/shaders.js';
import { createBlitFunction } from './webgl/BlitManager.js';
import * as FluidKernels from './webgl/FluidKernels.js';
import { renderFluid } from './webgl/RenderManager.js';
import { createSplat } from './webgl/SplatManager.js';
import defaultFluidConfig from './config/fluidConfig.js';

/**
 * Main fluid simulation class
 * Orchestrates the simulation steps and manages resources
 */
class FluidSimulation {
  /**
   * Creates a new fluid simulation
   * @param {WebGLRenderingContext} gl - The WebGL context
   * @param {Object} config - Configuration options
   */
  constructor(gl, config = {}) {
    console.log("FluidSimulation constructor called");
    this.gl = gl;
    this.config = { ...defaultFluidConfig, ...config }; // Merge with default config
    this.frameCount = 0;
    this.curlMax = 0;

    // Initialize WebGL context and extensions
    this.initWebGL();
    
    // Initialize shaders and programs
    this.initShaders();
    
    // Initialize framebuffers
    this.initFramebuffers();
    
    // Initialize blit function
    const blitManager = createBlitFunction(gl);
    this.blit = blitManager.blit;
    this.blitResources = blitManager.resources;
    
    // Set initial keywords for materials
    this.updateKeywords();
  }

  /**
   * Initialize WebGL context and extensions
   */
  initWebGL() {
    const contextResult = { 
      gl: this.gl, 
      ext: WebGLContextManager.getWebGLContext(this.gl.canvas).ext,
      isWebGL2: this.gl instanceof WebGL2RenderingContext
    };
    
    if (!contextResult) {
      console.error("WebGLContextManager.getWebGLContext failed");
      throw new Error("Failed to initialize WebGL context and extensions.");
    }
    
    console.log("WebGL context and extensions initialized successfully");
    this.ext = contextResult.ext;
    this.isWebGL2 = contextResult.isWebGL2;
    console.log("WebGL version:", this.isWebGL2 ? "WebGL 2" : "WebGL 1");
  }

  /**
   * Initialize shaders and programs
   */
  initShaders() {
    const gl = this.gl;
    
    // Compile the shared base vertex shader
    const baseVertexShader = compileShader(
      gl,
      gl.VERTEX_SHADER,
      shaders.baseVertexShaderSource
    );
    
    if (!baseVertexShader) {
      console.error("Base vertex shader failed to compile");
      throw new Error("Failed to compile base vertex shader.");
    }
    
    this.baseVertexShader = baseVertexShader;

    // Initialize Programs and Materials
    this.copyProgram = new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, shaders.copyShaderSource));
    this.clearProgram = new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, shaders.clearShaderSource));
    this.splatProgram = new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, shaders.splatShaderSource));
    this.advectionProgram = new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, shaders.advectionShaderSource));
    this.divergenceProgram = new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, shaders.divergenceShaderSource));
    this.curlProgram = new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, shaders.curlShaderSource));
    this.vorticityProgram = new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, shaders.vorticityShaderSource));
    this.pressureProgram = new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, shaders.pressureShaderSource));
    this.gradienSubtractProgram = new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, shaders.gradientSubtractShaderSource));

    // Display uses Material because it has the SHADING keyword option
    this.displayMaterial = new Material(gl, baseVertexShader, shaders.displayShaderSource);

    // Check if any program failed to initialize
    if (!this.copyProgram.program || !this.clearProgram.program || !this.splatProgram.program ||
        !this.advectionProgram.program || !this.divergenceProgram.program || !this.curlProgram.program ||
        !this.vorticityProgram.program || !this.pressureProgram.program || !this.gradienSubtractProgram.program) {
      this.dispose();
      throw new Error("Failed to initialize one or more shader programs.");
    }
  }

  /**
   * Initialize framebuffers
   */
  initFramebuffers() {
    if (!this.gl || !this.ext) {
      console.error("WebGL context or extensions not available for FBO initialization.");
      return;
    }

    let simRes = getResolution(this.config.SIM_RESOLUTION, this.gl);
    let dyeRes = getResolution(this.config.DYE_RESOLUTION, this.gl);
    const texType = this.ext.halfFloatTexType;
    const rgba = this.ext.formatRGBA;
    const rg = this.ext.formatRG;
    const r = this.ext.formatR;

    if (!rgba || !rg || !r) {
      throw new Error("Required texture formats (RGBA, RG, R) not supported by the GPU.");
    }

    // Determine filtering based on support
    const filtering = this.ext.supportLinearFiltering
      ? this.gl.LINEAR
      : this.gl.NEAREST;

    this.gl.disable(this.gl.BLEND); // Important for FBO rendering

    // Create or resize Dye FBO
    if (!this.dye)
      this.dye = createDoubleFBO(
        this.gl, dyeRes.width, dyeRes.height,
        rgba.internalFormat, rgba.format, texType, filtering
      );
    else
      this.dye = resizeDoubleFBO(
        this.gl, this.dye, dyeRes.width, dyeRes.height,
        rgba.internalFormat, rgba.format, texType, filtering
      );

    // Create or resize Velocity FBO
    if (!this.velocity)
      this.velocity = createDoubleFBO(
        this.gl, simRes.width, simRes.height,
        rg.internalFormat, rg.format, texType, filtering
      );
    else
      this.velocity = resizeDoubleFBO(
        this.gl, this.velocity, simRes.width, simRes.height,
        rg.internalFormat, rg.format, texType, filtering
      );

    // Create or resize single FBOs (Divergence, Curl)
    if (!this.divergence)
      this.divergence = createFBO(
        this.gl, simRes.width, simRes.height,
        r.internalFormat, r.format, texType, this.gl.NEAREST
      );
    else
      this.divergence = resizeFBO(
        this.gl, this.divergence, simRes.width, simRes.height,
        r.internalFormat, r.format, texType, this.gl.NEAREST
      );

    if (!this.curl)
      this.curl = createFBO(
        this.gl, simRes.width, simRes.height,
        r.internalFormat, r.format, texType, this.gl.NEAREST
      );
    else
      this.curl = resizeFBO(
        this.gl, this.curl, simRes.width, simRes.height,
        r.internalFormat, r.format, texType, this.gl.NEAREST
      );

    // Create or resize Pressure Double FBO
    if (!this.pressure)
      this.pressure = createDoubleFBO(
        this.gl, simRes.width, simRes.height,
        r.internalFormat, r.format, texType, this.gl.NEAREST
      );
    else
      this.pressure = resizeDoubleFBO(
        this.gl, this.pressure, simRes.width, simRes.height,
        r.internalFormat, r.format, texType, this.gl.NEAREST
      );

    // Check if any FBO creation failed
    if (!this.dye || !this.velocity || !this.divergence || !this.curl || !this.pressure) {
      throw new Error("Failed to initialize one or more framebuffers.");
    }
  }

  /**
   * Update shader keywords based on configuration
   */
  updateKeywords() {
    // Set keywords for the display material based on config
    let displayKeywords = [];
    if (this.config.SHADING) displayKeywords.push("SHADING");
    this.displayMaterial.setKeywords(displayKeywords);
  }

  /**
   * Perform one simulation step
   * @param {number} dt - Time step
   */
  step(dt) {
    if (!this.gl || !this.velocity || !this.dye || !this.pressure || !this.divergence || !this.curl) {
      console.error("Simulation cannot step, required resources missing.");
      return;
    }
    
    this.gl.disable(this.gl.BLEND);
    
    // 1. Advect Velocity
    this.gl.viewport(0, 0, this.velocity.width, this.velocity.height);
    FluidKernels.advectionStep(
      this.gl,
      this.advectionProgram,
      this.velocity,
      this.velocity,
      this.velocity,
      dt,
      this.config.VELOCITY_DISSIPATION,
      this.blit
    );
    
    // 2. Advect Dye
    this.gl.viewport(0, 0, this.dye.width, this.dye.height);
    FluidKernels.advectionStep(
      this.gl,
      this.advectionProgram,
      this.velocity,
      this.dye,
      this.dye,
      dt,
      this.config.DENSITY_DISSIPATION,
      this.blit
    );
    
    // 3. Curl (Vorticity Calculation)
    this.gl.viewport(0, 0, this.velocity.width, this.velocity.height);
    FluidKernels.curlStep(
      this.gl,
      this.curlProgram,
      this.velocity,
      this.curl,
      this.blit
    );
    
    // 4. Vorticity Confinement
    FluidKernels.vorticityStep(
      this.gl,
      this.vorticityProgram,
      this.velocity,
      this.curl,
      this.config.CURL,
      dt,
      this.blit
    );
    
    // 5. Divergence Calculation
    FluidKernels.divergenceStep(
      this.gl,
      this.divergenceProgram,
      this.velocity,
      this.divergence,
      this.blit
    );
    
    // 6. Clear Pressure (if needed)
    if (this.config.PRESSURE_DISSIPATION !== 1.0) {
      FluidKernels.clearPressureStep(
        this.gl,
        this.clearProgram,
        this.pressure,
        this.config.PRESSURE_DISSIPATION,
        this.blit
      );
    }
    
    // 7. Pressure Solve (Jacobi Iterations)
    FluidKernels.pressureStep(
      this.gl,
      this.pressureProgram,
      this.pressure,
      this.divergence,
      this.config.PRESSURE_ITERATIONS,
      this.blit
    );
    
    // 8. Gradient Subtraction
    FluidKernels.gradientSubtractStep(
      this.gl,
      this.gradienSubtractProgram,
      this.velocity,
      this.pressure,
      this.blit
    );
  }

  /**
   * Render the fluid simulation
   * @param {Object} target - Target framebuffer (null for screen)
   */
  render(target) {
    // Track frame count for logging
    this.frameCount = (this.frameCount || 0) + 1;
    
    // Only log once every 100 frames to reduce console spam
    if (this.frameCount % 100 === 0) {
      console.log(`Rendering frame ${this.frameCount} - Curl max: ${this.curlMax}`);
    }
    
    renderFluid(
      this.gl,
      this.displayMaterial,
      this.dye,
      this.velocity,
      this.curl,
      target,
      this.config,
      this.blit,
      this.curlProgram
    );
  }

  /**
   * Create a splat in the fluid
   * @param {number} x - X position (0-1)
   * @param {number} y - Y position (0-1)
   * @param {number} dx - X velocity
   * @param {number} dy - Y velocity
   * @param {Object} color - Color {r, g, b}
   */
  splat(x, y, dx, dy, color) {
    createSplat(
      this.gl,
      this.splatProgram,
      this.velocity,
      this.dye,
      x,
      y,
      dx,
      dy,
      color,
      this.config.SPLAT_RADIUS || 0.005,
      this.blit
    );
  }

  /**
   * Resize the simulation
   */
  resize() {
    console.log("Resizing FluidSimulation framebuffers...");
    try {
      this.initFramebuffers();
      console.log("Framebuffers resized successfully.");
    } catch (error) {
      console.error("Error during resize:", error);
    }
  }

  /**
   * Clean up resources
   */
  dispose() {
    console.log("Disposing FluidSimulation resources...");
    
    // Dispose FBOs
    if (this.dye) this.dye.dispose();
    if (this.velocity) this.velocity.dispose();
    if (this.divergence) this.divergence.dispose();
    if (this.curl) this.curl.dispose();
    if (this.pressure) this.pressure.dispose();

    // Dispose Programs and Materials
    if (this.copyProgram) this.copyProgram.dispose();
    if (this.clearProgram) this.clearProgram.dispose();
    if (this.splatProgram) this.splatProgram.dispose();
    if (this.advectionProgram) this.advectionProgram.dispose();
    if (this.divergenceProgram) this.divergenceProgram.dispose();
    if (this.curlProgram) this.curlProgram.dispose();
    if (this.vorticityProgram) this.vorticityProgram.dispose();
    if (this.pressureProgram) this.pressureProgram.dispose();
    if (this.gradienSubtractProgram) this.gradienSubtractProgram.dispose();
    if (this.displayMaterial) this.displayMaterial.dispose();

    // Dispose the shared vertex shader
    if (this.baseVertexShader) this.gl.deleteShader(this.baseVertexShader);

    // Dispose blit resources
    if (this.blitResources) {
      if (this.blitResources.quadVertexBuffer) this.gl.deleteBuffer(this.blitResources.quadVertexBuffer);
      if (this.blitResources.quadIndexBuffer) this.gl.deleteBuffer(this.blitResources.quadIndexBuffer);
    }

    // Nullify references
    this.dye = this.velocity = this.divergence = this.curl = this.pressure = null;
    this.copyProgram = this.clearProgram = this.splatProgram = this.advectionProgram = null;
    this.divergenceProgram = this.curlProgram = this.vorticityProgram = this.pressureProgram = null;
    this.gradienSubtractProgram = this.displayMaterial = this.baseVertexShader = null;
    this.blitResources = null;
    this.blit = () => {}; // Make blit a no-op after disposal
    
    console.log("FluidSimulation resources disposed.");
  }
}

export default FluidSimulation;
