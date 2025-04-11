// src/FluidSimulation.js
import WebGLContextManager from './webgl/WebGLContextManager.js'; // Correct path
import { Program, Material, compileShader } from './webgl/ShaderManager.js'; // Correct path
import { createFBO, createDoubleFBO, resizeFBO, resizeDoubleFBO } from './webgl/FramebufferManager.js'; // Correct path

// --- Utility Functions ---
const getResolution = (resolution, gl) => {
  if (!gl) return { width: 0, height: 0 };
  let aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
  if (aspectRatio < 1) aspectRatio = 1.0 / aspectRatio;
  const min = Math.round(resolution);
  const max = Math.round(resolution * aspectRatio);
  if (gl.drawingBufferWidth > gl.drawingBufferHeight)
    return { width: max, height: min };
  else return { width: min, height: max };
};

// Placeholder for correctRadius - definition was missing in original file
const correctRadius = (radius) => {
    // TODO: Implement the correct logic for adjusting radius based on aspect ratio or other factors
    // console.warn("correctRadius function is a placeholder.");
    return radius;
};


// --- Shader Sources ---
const baseVertexShaderSource = `
  precision highp float;
  attribute vec2 aPosition;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform vec2 texelSize;

  void main () {
      vUv = aPosition * 0.5 + 0.5;
      vL = vUv - vec2(texelSize.x, 0.0);
      vR = vUv + vec2(texelSize.x, 0.0);
      vT = vUv + vec2(0.0, texelSize.y);
      vB = vUv - vec2(0.0, texelSize.y);
      gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

const copyShaderSource = `
  precision mediump float;
  precision mediump sampler2D;
  varying highp vec2 vUv;
  uniform sampler2D uTexture;

  void main () {
      gl_FragColor = texture2D(uTexture, vUv);
  }
`;

const clearShaderSource = `
  precision mediump float;
  precision mediump sampler2D;
  varying highp vec2 vUv;
  uniform sampler2D uTexture;
  uniform float value;

  void main () {
      gl_FragColor = value * texture2D(uTexture, vUv);
  }
`;

const displayShaderSource = `
  precision highp float;
  precision highp sampler2D;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uTexture;
  // uniform sampler2D uDithering; // Dithering removed for simplicity, add back if needed
  // uniform vec2 ditherScale;
  uniform vec2 texelSize;

  vec3 linearToGamma (vec3 color) {
      color = max(color, vec3(0));
      return max(1.055 * pow(color, vec3(0.416666667)) - 0.055, vec3(0));
  }

  void main () {
      vec3 c = texture2D(uTexture, vUv).rgb;
      #ifdef SHADING
          vec3 lc = texture2D(uTexture, vL).rgb;
          vec3 rc = texture2D(uTexture, vR).rgb;
          vec3 tc = texture2D(uTexture, vT).rgb;
          vec3 bc = texture2D(uTexture, vB).rgb;

          float dx = length(rc) - length(lc);
          float dy = length(tc) - length(bc);

          vec3 n = normalize(vec3(dx, dy, length(texelSize)));
          vec3 l = vec3(0.0, 0.0, 1.0);

          float diffuse = clamp(dot(n, l) + 0.7, 0.7, 1.0);
          c *= diffuse;
      #endif

      // Apply gamma correction if needed, or handle color space conversion
      // c = linearToGamma(c); // Uncomment if gamma correction is desired

      float a = max(c.r, max(c.g, c.b)); // Basic alpha based on max component
      gl_FragColor = vec4(c, a);
  }
`;

const splatShaderSource = `
  precision highp float;
  precision highp sampler2D;
  varying vec2 vUv;
  uniform sampler2D uTarget;
  uniform float aspectRatio;
  uniform vec3 color;
  uniform vec2 point;
  uniform float radius;

  void main () {
      vec2 p = vUv - point.xy;
      p.x *= aspectRatio; // Adjust for aspect ratio
      vec3 splat = exp(-dot(p, p) / radius) * color; // Gaussian splat
      vec3 base = texture2D(uTarget, vUv).xyz;
      gl_FragColor = vec4(base + splat, 1.0); // Add splat to base color
  }
`;

const advectionShaderSource = `
  precision highp float;
  precision highp sampler2D;
  varying vec2 vUv;
  uniform sampler2D uVelocity;
  uniform sampler2D uSource;
  uniform vec2 texelSize; // Size of velocity texture texels
  uniform vec2 dyeTexelSize; // Size of dye texture texels (can be different)
  uniform float dt; // Timestep
  uniform float dissipation; // Dissipation factor

  // Bilinear interpolation function
  vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
      vec2 st = uv / tsize - 0.5;
      vec2 iuv = floor(st);
      vec2 fuv = fract(st);

      // Sample the four nearest texels
      vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
      vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
      vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
      vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);

      // Interpolate horizontally, then vertically
      return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
  }

  void main () {
      #ifdef MANUAL_FILTERING
          // Manual bilinear filtering for advection
          vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize; // Backtrace coordinate
          vec4 result = bilerp(uSource, coord, dyeTexelSize); // Sample source texture at backtraced coordinate
      #else
          // Hardware linear filtering (if supported and enabled)
          vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize; // Backtrace coordinate
          vec4 result = texture2D(uSource, coord); // Sample source texture
      #endif
      float decay = 1.0 + dissipation * dt; // Calculate decay factor
      gl_FragColor = result / decay; // Apply dissipation
  }
`;

const divergenceShaderSource = `
  precision mediump float;
  precision mediump sampler2D;
  varying highp vec2 vUv;
  varying highp vec2 vL; // Left neighbor UV
  varying highp vec2 vR; // Right neighbor UV
  varying highp vec2 vT; // Top neighbor UV
  varying highp vec2 vB; // Bottom neighbor UV
  uniform sampler2D uVelocity; // Velocity field texture

  void main () {
      // Sample velocity components from neighbors
      float L = texture2D(uVelocity, vL).x;
      float R = texture2D(uVelocity, vR).x;
      float T = texture2D(uVelocity, vT).y;
      float B = texture2D(uVelocity, vB).y;

      // Handle boundary conditions (optional, depends on desired behavior)
      vec2 C = texture2D(uVelocity, vUv).xy;
      if (vL.x < 0.0) { L = -C.x; } // Reflective boundary left
      if (vR.x > 1.0) { R = -C.x; } // Reflective boundary right
      if (vT.y > 1.0) { T = -C.y; } // Reflective boundary top
      if (vB.y < 0.0) { B = -C.y; } // Reflective boundary bottom

      // Calculate divergence using central differencing
      float div = 0.5 * (R - L + T - B);
      gl_FragColor = vec4(div, 0.0, 0.0, 1.0); // Store divergence in red channel
  }
`;

const curlShaderSource = `
  precision mediump float;
  precision mediump sampler2D;
  varying highp vec2 vUv;
  varying highp vec2 vL;
  varying highp vec2 vR;
  varying highp vec2 vT;
  varying highp vec2 vB;
  uniform sampler2D uVelocity; // Velocity field texture

  void main () {
      // Sample velocity components from neighbors
      float L = texture2D(uVelocity, vL).y; // y-component of left neighbor
      float R = texture2D(uVelocity, vR).y; // y-component of right neighbor
      float T = texture2D(uVelocity, vT).x; // x-component of top neighbor
      float B = texture2D(uVelocity, vB).x; // x-component of bottom neighbor

      // Calculate curl (vorticity) using central differencing
      // curl = dVx/dy - dVy/dx (approximated)
      // Note: The original shader seems to calculate R - L - T + B. Let's verify the formula.
      // Curl_z = (dVy/dx - dVx/dy). Approximation: (R_y - L_y)/dx - (T_x - B_x)/dy
      // Assuming dx=dy=1 for simplicity in grid space: R_y - L_y - (T_x - B_x) = R_y - L_y - T_x + B_x
      // The original seems to be calculating T_x - B_x - (R_y - L_y) = T_x - B_x - R_y + L_y
      // Let's stick to the original implementation's calculation: R - L - T + B
      float vorticity = R - L - T + B;

      gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0); // Store curl in red channel, scaled
  }
`;

const vorticityShaderSource = `
  precision highp float;
  precision highp sampler2D;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uVelocity; // Current velocity field
  uniform sampler2D uCurl;     // Curl (vorticity) field
  uniform float curl;        // Curl confinement strength parameter
  uniform float dt;          // Timestep

  void main () {
      // Sample curl values from neighbors and center
      float L = texture2D(uCurl, vL).x;
      float R = texture2D(uCurl, vR).x;
      float T = texture2D(uCurl, vT).x;
      float B = texture2D(uCurl, vB).x;
      float C = texture2D(uCurl, vUv).x; // Center curl value

      // Calculate the gradient of the absolute curl magnitude (approximated)
      // Force points towards higher curl magnitude to confine vorticity
      vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));

      // Normalize the force vector (avoid division by zero)
      force /= length(force) + 0.0001;

      // Apply curl confinement force, scaled by the center curl value and strength parameter
      force *= curl * C;

      // The original shader flips the y-component. Let's keep it for consistency.
      force.y *= -1.0;

      // Get current velocity
      vec2 velocity = texture2D(uVelocity, vUv).xy;

      // Add the vorticity confinement force to the velocity (scaled by dt)
      velocity += force * dt;

      // Clamp velocity to prevent instability (optional but recommended)
      velocity = min(max(velocity, -1000.0), 1000.0);

      gl_FragColor = vec4(velocity, 0.0, 1.0); // Output updated velocity
  }
`;

const pressureShaderSource = `
  precision mediump float;
  precision mediump sampler2D;
  varying highp vec2 vUv;
  varying highp vec2 vL;
  varying highp vec2 vR;
  varying highp vec2 vT;
  varying highp vec2 vB;
  uniform sampler2D uPressure;   // Pressure field from previous iteration
  uniform sampler2D uDivergence; // Divergence field

  void main () {
      // Sample pressure from neighbors and divergence from center
      float L = texture2D(uPressure, vL).x;
      float R = texture2D(uPressure, vR).x;
      float T = texture2D(uPressure, vT).x;
      float B = texture2D(uPressure, vB).x;
      // float C = texture2D(uPressure, vUv).x; // Center pressure (not used in this Jacobi iteration step)
      float divergence = texture2D(uDivergence, vUv).x;

      // Jacobi iteration for Poisson equation:
      // Solve nabla^2(Pressure) = Divergence
      // Approximation: (L + R + T + B - 4*C) / h^2 = Divergence
      // Rearranging for C (next iteration): C = (L + R + T + B - Divergence * h^2) / 4
      // Assuming h=1 (grid spacing): Pressure = (L + R + B + T - Divergence) * 0.25
      float pressure = (L + R + B + T - divergence) * 0.25;

      gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0); // Output calculated pressure
  }
`;

const gradientSubtractShaderSource = `
  precision mediump float;
  precision mediump sampler2D;
  varying highp vec2 vUv;
  varying highp vec2 vL;
  varying highp vec2 vR;
  varying highp vec2 vT;
  varying highp vec2 vB;
  uniform sampler2D uPressure; // Solved pressure field
  uniform sampler2D uVelocity; // Current (divergent) velocity field

  void main () {
      // Sample pressure from neighbors
      float L = texture2D(uPressure, vL).x;
      float R = texture2D(uPressure, vR).x;
      float T = texture2D(uPressure, vT).x;
      float B = texture2D(uPressure, vB).x;

      // Get current velocity
      vec2 velocity = texture2D(uVelocity, vUv).xy;

      // Calculate pressure gradient using central differencing
      // grad(Pressure) = ( (R - L) / (2*dx), (T - B) / (2*dy) )
      // Assuming dx=dy=1 for grid space: grad(Pressure) = 0.5 * (R - L, T - B)
      // Subtract the pressure gradient from the velocity field to make it divergence-free
      // Velocity_new = Velocity_old - grad(Pressure) * dt (dt often incorporated or assumed 1)
      // The shader uses vec2(R - L, T - B) which is 2 * grad(Pressure).
      // This might be intentional scaling or assumes a different formulation. Let's stick to it.
      velocity.xy -= vec2(R - L, T - B); // Subtract scaled gradient

      gl_FragColor = vec4(velocity, 0.0, 1.0); // Output divergence-free velocity
  }
`;


// --- Fluid Simulation Class ---
class FluidSimulation {
  constructor(gl, config) {
    this.gl = gl;
    this.config = config; // Store config for later use

    const contextResult = WebGLContextManager.getWebGLContext(gl.canvas);
    if (!contextResult) {
        throw new Error("Failed to initialize WebGL context and extensions.");
    }
    this.ext = contextResult.ext;
    this.isWebGL2 = contextResult.isWebGL2; // Store WebGL version flag

    // Compile the shared base vertex shader
const baseVertexShader = compileShader(
  gl,
  gl.VERTEX_SHADER,
  baseVertexShaderSource
);
if (!baseVertexShader) {
  console.error("Base vertex shader failed to compile. Source:", baseVertexShaderSource);
        // Shader compilation error is logged in compileShader
        throw new Error("Failed to compile base vertex shader.");
    }
    this.baseVertexShader = baseVertexShader; // Store for potential cleanup


    // --- Initialize Programs and Materials ---
    // Use Program for shaders without keywords, Material for shaders with keywords
this.copyProgram = new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, copyShaderSource));
this.clearProgram = new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, clearShaderSource));
this.splatProgram = new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, splatShaderSource));
this.advectionProgram = new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, advectionShaderSource));
this.divergenceProgram = new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, divergenceShaderSource));
this.curlProgram = new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, curlShaderSource));
this.vorticityProgram = new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, vorticityShaderSource));
this.pressureProgram = new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, pressureShaderSource));
this.gradienSubtractProgram = new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, gradientSubtractShaderSource));

    // Display uses Material because it has the SHADING keyword option
    this.displayMaterial = new Material(gl, baseVertexShader, displayShaderSource);

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

      return (target, clear = false) => {
        if (target == null) {
          // Blitting to canvas
          gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        } else {
          // Blitting to FBO
          gl.viewport(0, 0, target.width, target.height);
          gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
        }
        if (clear) {
          gl.clearColor(0.0, 0.0, 0.0, 1.0); // Set clear color
          gl.clear(gl.COLOR_BUFFER_BIT);     // Clear
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
  }

  // --- Rendering ---

  render(target) {
     if (!this.gl || !this.dye || !this.displayMaterial) {
        console.error("Cannot render, required resources missing.");
        return;
    }
    // Render dye to the target (null for canvas)
    this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA); // Or appropriate blend mode
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
    this.gl.uniform1i(this.displayMaterial.uniforms.uTexture, this.dye.read.attach(0)); // Render the dye texture

    // Add uniforms for dithering if needed and configured
    // if (this.config.DITHERING && this.ditheringTexture && this.displayMaterial.uniforms.uDithering) {
    //     this.gl.uniform1i(this.displayMaterial.uniforms.uDithering, this.ditheringTexture.attach(1));
    //     // Calculate dither scale based on target size and texture size
    //     const scaleX = (target ? target.width : this.gl.drawingBufferWidth) / this.ditheringTexture.width;
    //     const scaleY = (target ? target.height : this.gl.drawingBufferHeight) / this.ditheringTexture.height;
    //     this.gl.uniform2f(this.displayMaterial.uniforms.ditherScale, scaleX, scaleY);
    // }

    this.blit(target, this.config.TRANSPARENT); // Blit to target, clear if background is transparent

    this.gl.disable(this.gl.BLEND);
  }

  // --- Interaction ---

  splat(x, y, dx, dy, color) {
     if (!this.gl || !this.velocity || !this.dye || !this.splatProgram || !this.splatProgram.program) {
        console.error("Cannot splat, required resources missing or program invalid.");
        return;
    }

    // Splat velocity
    this.gl.viewport(0, 0, this.velocity.width, this.velocity.height);
    this.splatProgram.bind();
    this.gl.uniform1i(this.splatProgram.uniforms.uTarget, this.velocity.read.attach(0));
    this.gl.uniform1f(this.splatProgram.uniforms.aspectRatio, this.gl.canvas.width / this.gl.canvas.height);
    this.gl.uniform2f(this.splatProgram.uniforms.point, x, y); // Normalized coordinates (0-1)
    this.gl.uniform3f(this.splatProgram.uniforms.color, dx, dy, 0.0); // Velocity change
    this.gl.uniform1f(this.splatProgram.uniforms.radius, correctRadius(this.config.SPLAT_RADIUS / 100.0));
    this.blit(this.velocity.write);
    this.velocity.swap();

    // Splat dye
    this.gl.viewport(0, 0, this.dye.width, this.dye.height);
    // splatProgram is already bound
    this.gl.uniform1i(this.splatProgram.uniforms.uTarget, this.dye.read.attach(0));
    // Aspect ratio might need adjustment if dye/velocity aspect ratios differ significantly
    // Consider using dye aspect ratio if resolutions differ:
    // this.gl.uniform1f(this.splatProgram.uniforms.aspectRatio, this.dye.width / this.dye.height);
    this.gl.uniform3f(this.splatProgram.uniforms.color, color.r, color.g, color.b); // Dye color
    // Radius might also need adjustment based on dye resolution vs sim resolution
    this.blit(this.dye.write);
    this.dye.swap();
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
