// src/FluidSimulation.js
import WebGLContextManager from './webgl/WebGLContextManager.js'; // Correct path
import { Program, Material, compileShader } from './webgl/ShaderManager.js'; // Removed unused createProgram import
import { createFBO, createDoubleFBO, resizeFBO, resizeDoubleFBO } from './webgl/FramebufferManager.js'; // Correct path
import { getResolution, correctRadius } from './utils.js'; // Import utilities
import * as shaders from './webgl/shaders.js'; // Import all shaders


// --- Fluid Simulation Class ---
class FluidSimulation {
  constructor(gl, config) {
    console.log("FluidSimulation constructor called");
    this.gl = gl;
    this.config = config; // Store config for later use

    // Use the provided WebGL context instead of creating a new one
    // This ensures we use the same context with preserveDrawingBuffer: true
    const contextResult = { 
      gl: gl, 
      ext: WebGLContextManager.getWebGLContext(gl.canvas).ext,
      isWebGL2: gl instanceof WebGL2RenderingContext
    };
    if (!contextResult) {
        console.error("WebGLContextManager.getWebGLContext failed");
        throw new Error("Failed to initialize WebGL context and extensions.");
    }
    console.log("WebGL context and extensions initialized successfully");
    this.ext = contextResult.ext;
    this.isWebGL2 = contextResult.isWebGL2; // Store WebGL version flag
    console.log("WebGL version:", this.isWebGL2 ? "WebGL 2" : "WebGL 1");
    console.log("Extensions:", this.ext);

    // Compile the shared base vertex shader
const baseVertexShader = compileShader(
  gl,
  gl.VERTEX_SHADER,
  shaders.baseVertexShaderSource // Use imported shader
);
if (!baseVertexShader) {
  console.error("Base vertex shader failed to compile. Source:", shaders.baseVertexShaderSource);
        // Shader compilation error is logged in compileShader
        throw new Error("Failed to compile base vertex shader.");
    }
    this.baseVertexShader = baseVertexShader; // Store for potential cleanup


    // --- Initialize Programs and Materials ---
    // Use Program for shaders without keywords, Material for shaders with keywords
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
    console.log("Checking shader program initialization status:", {
  copyProgram: !!this.copyProgram.program,
  clearProgram: !!this.clearProgram.program,
  splatProgram: !!this.splatProgram.program,
  advectionProgram: !!this.advectionProgram.program,
  divergenceProgram: !!this.divergenceProgram.program,
  curlProgram: !!this.curlProgram.program,
  vorticityProgram: !!this.vorticityProgram.program,
  pressureProgram: !!this.pressureProgram.program,
  gradientSubtractProgram: !!this.gradienSubtractProgram.program
});

if (!this.copyProgram.program || !this.clearProgram.program || !this.splatProgram.program ||
        !this.advectionProgram.program || !this.divergenceProgram.program || !this.curlProgram.program ||
        !this.vorticityProgram.program || !this.pressureProgram.program || !this.gradienSubtractProgram.program) {
        this.dispose(); // Clean up partially created resources
        throw new Error("Failed to initialize one or more shader programs.");
    }


    // --- Framebuffers ---
    this.dye = null;
    this.velocity = null;
    this.divergence = null;
    this.curl = null;
    this.pressure = null;

    // --- Blit Function ---
    // Setup for drawing a quad to the screen or FBO
    this.blit = (() => {
      const quadVertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quadVertexBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), // Quad vertices
        gl.STATIC_DRAW
      );
      this.quadVertexBuffer = quadVertexBuffer; // Store for cleanup

      const quadIndexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, quadIndexBuffer);
      gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array([0, 1, 2, 0, 2, 3]), // Quad indices
        gl.STATIC_DRAW
      );
      this.quadIndexBuffer = quadIndexBuffer; // Store for cleanup

      // Assuming vertex attribute location 0 is used for position (aPosition in vertex shader)
      // This setup should ideally be done once, maybe using a VAO if available (WebGL2)
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(0);

      // Unbind buffers after setup
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      // Keep ELEMENT_ARRAY_BUFFER bound as it's needed for drawElements

      return (target, clear = false) => { // Re-added clear parameter, default false
        if (target == null) {
          // Blitting to canvas
          gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        } else {
          // Blitting to FBO
          gl.viewport(0, 0, target.width, target.height);
          gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
          if (clear) { // Only clear if explicitly requested
            // Only clear FBO targets, not the main canvas
            gl.clearColor(0.0, 0.0, 0.0, 1.0); // Clear FBOs to black
            gl.clear(gl.COLOR_BUFFER_BIT);
          }
        }
        // Bind necessary buffers and draw
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVertexBuffer); // Ensure vertex buffer is bound
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); // Re-specify attribute pointer (needed if VAO not used)
        gl.enableVertexAttribArray(0); // Ensure attribute array is enabled
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quadIndexBuffer); // Ensure index buffer is bound
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0); // Draw the quad
      };
    })();

    try {
        this.initFramebuffers();
        this.updateKeywords(); // Set initial keywords for materials
    } catch (error) {
        console.error("Error during initialization:", error);
console.trace("Stack trace for initialization error:");
        this.dispose(); // Clean up resources if initialization fails
        throw error; // Re-throw the error
    }
  }

  initFramebuffers() {
    if (!this.gl || !this.ext) {
        console.error("WebGL context or extensions not available for FBO initialization.");
        // No need to throw here if constructor handles it, but good practice
        return; // Exit if context is missing
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

     // Check if any FBO creation failed (createFBO/createDoubleFBO now return null on failure)
     if (!this.dye || !this.velocity || !this.divergence || !this.curl || !this.pressure) {
         // Error messages are logged within the FBO functions
         throw new Error("Failed to initialize one or more framebuffers.");
     }

  }

  updateKeywords() {
    // Set keywords for the display material based on config
    let displayKeywords = [];
    if (this.config.SHADING) displayKeywords.push("SHADING");
    this.displayMaterial.setKeywords(displayKeywords);

    // Set keywords for advection based on filtering support
    // NOTE: Advection program is currently a 'Program', not 'Material'.
    // If MANUAL_FILTERING is needed, we either need two pre-compiled
    // advection programs or change advectionProgram to be a Material.
    // For now, assuming the shader source handles this or filtering is supported.
    // if (!this.ext.supportLinearFiltering) {
    //     console.warn("Linear filtering not supported, MANUAL_FILTERING might be needed for advection.");
    // }
  }

  // --- Simulation Steps ---

  step(dt) {
    // Restore step function body
    if (!this.gl || !this.velocity || !this.dye || !this.pressure || !this.divergence || !this.curl) {
        console.error("Simulation cannot step, required resources missing.");
        return;
    }
    this.gl.disable(this.gl.BLEND);
    this.gl.viewport(0, 0, this.velocity.width, this.velocity.height); // Set viewport to sim resolution

    // 1. Advect Velocity
    this.advectionProgram.bind();
    this.gl.uniform2f(this.advectionProgram.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY);
    this.gl.uniform1i(this.advectionProgram.uniforms.uVelocity, this.velocity.read.attach(0));
    this.gl.uniform1i(this.advectionProgram.uniforms.uSource, this.velocity.read.attach(0)); // Advect velocity itself
    this.gl.uniform1f(this.advectionProgram.uniforms.dt, dt);
    this.gl.uniform1f(this.advectionProgram.uniforms.dissipation, this.config.VELOCITY_DISSIPATION);
    // Assuming dyeTexelSize uniform is not strictly needed when advecting velocity itself
    // If the shader requires it, set it:
    // this.gl.uniform2f(this.advectionProgram.uniforms.dyeTexelSize, this.velocity.texelSizeX, this.velocity.texelSizeY);
    this.blit(this.velocity.write);
    this.velocity.swap();

    // 2. Advect Dye
    this.gl.viewport(0, 0, this.dye.width, this.dye.height); // Set viewport to dye resolution
    // Advection program is already bound
    this.gl.uniform1i(this.advectionProgram.uniforms.uVelocity, this.velocity.read.attach(0)); // Use updated velocity
    this.gl.uniform1i(this.advectionProgram.uniforms.uSource, this.dye.read.attach(1));      // Advect dye
    this.gl.uniform2f(this.advectionProgram.uniforms.dyeTexelSize, this.dye.texelSizeX, this.dye.texelSizeY); // Pass dye texel size
    this.gl.uniform1f(this.advectionProgram.uniforms.dissipation, this.config.DENSITY_DISSIPATION);
    this.blit(this.dye.write);
    this.dye.swap();

    // 3. Curl (Vorticity Calculation)
    this.gl.viewport(0, 0, this.velocity.width, this.velocity.height); // Back to sim resolution
    this.curlProgram.bind();
    // texelSize uniform might be missing from getUniforms if not used in vertex shader for this program
    if (this.curlProgram.uniforms.texelSize) {
        this.gl.uniform2f(this.curlProgram.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY);
    }
    this.gl.uniform1i(this.curlProgram.uniforms.uVelocity, this.velocity.read.attach(0));
    this.blit(this.curl); // Output to curl FBO

    // 4. Vorticity Confinement
    this.vorticityProgram.bind();
     if (this.vorticityProgram.uniforms.texelSize) {
        this.gl.uniform2f(this.vorticityProgram.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY);
     }
    this.gl.uniform1i(this.vorticityProgram.uniforms.uVelocity, this.velocity.read.attach(0));
    this.gl.uniform1i(this.vorticityProgram.uniforms.uCurl, this.curl.attach(1)); // Use calculated curl
    this.gl.uniform1f(this.vorticityProgram.uniforms.curl, this.config.CURL);
    this.gl.uniform1f(this.vorticityProgram.uniforms.dt, dt);
    this.blit(this.velocity.write); // Output confined velocity
    this.velocity.swap();

    // 5. Divergence Calculation
    this.divergenceProgram.bind();
    if (this.divergenceProgram.uniforms.texelSize) {
        this.gl.uniform2f(this.divergenceProgram.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY);
    }
    this.gl.uniform1i(this.divergenceProgram.uniforms.uVelocity, this.velocity.read.attach(0)); // Use confined velocity
    this.blit(this.divergence); // Output to divergence FBO

    // 6. Pressure Solve (Jacobi Iterations)
    // Optional: Clear pressure field with dissipation before iterations
    if (this.config.PRESSURE_DISSIPATION !== 1.0) { // Only clear if dissipation is not 1 (i.e., no change)
        this.clearProgram.bind();
        this.gl.uniform1i(this.clearProgram.uniforms.uTexture, this.pressure.read.attach(0));
        this.gl.uniform1f(this.clearProgram.uniforms.value, this.config.PRESSURE_DISSIPATION);
        this.blit(this.pressure.write);
        this.pressure.swap();
    }


    this.pressureProgram.bind();
    if (this.pressureProgram.uniforms.texelSize) {
        this.gl.uniform2f(this.pressureProgram.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY);
    }
    this.gl.uniform1i(this.pressureProgram.uniforms.uDivergence, this.divergence.attach(0)); // Use calculated divergence
    for (let i = 0; i < this.config.PRESSURE_ITERATIONS; i++) {
      this.gl.uniform1i(this.pressureProgram.uniforms.uPressure, this.pressure.read.attach(1));
      this.blit(this.pressure.write);
      this.pressure.swap();
    }

    // 7. Gradient Subtraction (Make Velocity Field Divergence-Free)
    this.gradienSubtractProgram.bind(); // Corrected variable name
    if (this.gradienSubtractProgram.uniforms.texelSize) {
        this.gl.uniform2f(this.gradienSubtractProgram.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY);
    }
    this.gl.uniform1i(this.gradienSubtractProgram.uniforms.uPressure, this.pressure.read.attach(0)); // Use solved pressure
    this.gl.uniform1i(this.gradienSubtractProgram.uniforms.uVelocity, this.velocity.read.attach(1)); // Use velocity after vorticity
    this.blit(this.velocity.write); // Output divergence-free velocity
    this.velocity.swap();
    // End of restored step function body
  }

  // --- Rendering ---

  render(target) {
     if (!this.gl || !this.dye || !this.displayMaterial) {
        console.error("Cannot render, required resources missing.");
        return;
    }
    
    // Only log once every 100 frames to reduce console spam
    if (this.frameCount % 100 === 0) {
        console.log(`Rendering dye texture - Width: ${this.dye.width}, Height: ${this.dye.height}`);
    }
    this.frameCount = (this.frameCount || 0) + 1;
    
    // Do NOT clear the canvas between frames to preserve splats
    // We're using preserveDrawingBuffer: true in the WebGL context options
    
    // Render dye to the target (null for canvas)
    this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA); // Revert to standard alpha blending
    this.gl.enable(this.gl.BLEND);

    // Set viewport for rendering
    if (target == null) {
        this.gl.viewport(0, 0, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
    } else {
        // Ensure target is a valid FBO-like object
        if (typeof target.width !== 'number' || typeof target.height !== 'number') {
             console.error("Invalid render target provided.");
             return;
        }
        this.gl.viewport(0, 0, target.width, target.height);
    }

    this.displayMaterial.bind(); // Bind the display material (handles keywords)

    // Set uniforms for display shader
    if (this.displayMaterial.uniforms.texelSize) {
        // Use dye texel size for display, assuming display matches dye resolution
        this.gl.uniform2f(this.displayMaterial.uniforms.texelSize, this.dye.texelSizeX, this.dye.texelSizeY);
    }
    
    // Attach dye texture and set uniform
    const textureUnit = this.dye.read.attach(0);
    this.gl.uniform1i(this.displayMaterial.uniforms.uTexture, textureUnit);

    // When rendering to canvas (target == null), do not clear.
    // The TRANSPARENT config is likely for FBOs, not the final canvas render.
    this.blit(target); // Rely on default clear = false

    this.gl.disable(this.gl.BLEND);
  }

  // --- Interaction ---

  splat(x, y, dx, dy, color) {
     if (!this.gl || !this.velocity || !this.dye || !this.splatProgram || !this.splatProgram.program) {
        console.error("Cannot splat, required resources missing or program invalid.");
        console.error("GL:", !!this.gl, "Velocity:", !!this.velocity, "Dye:", !!this.dye, 
                     "SplatProgram:", !!this.splatProgram, 
                     "SplatProgram.program:", this.splatProgram ? !!this.splatProgram.program : "N/A");
        return;
    }

    console.log(`SPLAT called at (${x.toFixed(3)}, ${y.toFixed(3)}) with color (${color.r.toFixed(2)}, ${color.g.toFixed(2)}, ${color.b.toFixed(2)})`);

    // Amplify the color to make it more visible
    const amplifiedColor = {
        r: color.r * 10.0,
        g: color.g * 10.0,
        b: color.b * 10.0
    };

    // Splat velocity
    this.gl.viewport(0, 0, this.velocity.width, this.velocity.height);
    this.splatProgram.bind();
    this.gl.uniform1i(this.splatProgram.uniforms.uTarget, this.velocity.read.attach(0));
    this.gl.uniform1f(this.splatProgram.uniforms.aspectRatio, this.gl.canvas.width / this.gl.canvas.height);
    this.gl.uniform2f(this.splatProgram.uniforms.point, x, y); // Normalized coordinates (0-1)
    this.gl.uniform3f(this.splatProgram.uniforms.color, dx, dy, 0.0); // Velocity change
    
    // Use fixed large radius instead of calculated one
    this.gl.uniform1f(this.splatProgram.uniforms.radius, 0.1);
    
    console.log(`Splat Velocity - Point: (${x.toFixed(3)}, ${y.toFixed(3)}), Radius: 0.1`);
    
    this.blit(this.velocity.write);
    this.velocity.swap();
    console.log("Velocity splat complete and buffers swapped");

    // Splat dye
    this.gl.viewport(0, 0, this.dye.width, this.dye.height);
    // splatProgram is already bound
    this.gl.uniform1i(this.splatProgram.uniforms.uTarget, this.dye.read.attach(0));
    
    // Use amplified color
    this.gl.uniform3f(this.splatProgram.uniforms.color, amplifiedColor.r, amplifiedColor.g, amplifiedColor.b);
    
    // Use fixed large radius for dye as well
    this.gl.uniform1f(this.splatProgram.uniforms.radius, 0.1);
    
    console.log(`Splat Dye - Point: (${x.toFixed(3)}, ${y.toFixed(3)}), Color: (${amplifiedColor.r.toFixed(2)}, ${amplifiedColor.g.toFixed(2)}, ${amplifiedColor.b.toFixed(2)}), Radius: 0.1`);
    
    this.blit(this.dye.write); // Draw splat into dye.write
    this.dye.swap(); // Enable swap to make the splat visible
    console.log("Dye splat complete and buffers swapped");
  }

  // --- Cleanup ---
  dispose() {
      console.log("Disposing FluidSimulation resources...");
      // Dispose FBOs safely
      if (this.dye) this.dye.dispose();
      if (this.velocity) this.velocity.dispose();
      if (this.divergence) this.divergence.dispose();
      if (this.curl) this.curl.dispose();
      if (this.pressure) this.pressure.dispose();

      // Dispose Programs and Materials safely
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
      if (this.quadVertexBuffer) this.gl.deleteBuffer(this.quadVertexBuffer);
      if (this.quadIndexBuffer) this.gl.deleteBuffer(this.quadIndexBuffer);

      // Nullify references
      this.dye = this.velocity = this.divergence = this.curl = this.pressure = null;
      this.copyProgram = this.clearProgram = this.splatProgram = this.advectionProgram = null;
      this.divergenceProgram = this.curlProgram = this.vorticityProgram = this.pressureProgram = null;
      this.gradienSubtractProgram = this.displayMaterial = this.baseVertexShader = null;
      this.quadVertexBuffer = this.quadIndexBuffer = null;
      this.blit = () => {}; // Make blit a no-op after disposal
      console.log("FluidSimulation resources disposed.");
  }

  // --- Resize ---
  resize() {
      console.log("Resizing FluidSimulation framebuffers...");
      try {
          this.initFramebuffers();
          console.log("Framebuffers resized successfully.");
      } catch (error) {
          console.error("Error during resize:", error);
          // Handle resize error, maybe attempt to recover or notify user
      }
  }
}

export default FluidSimulation;
