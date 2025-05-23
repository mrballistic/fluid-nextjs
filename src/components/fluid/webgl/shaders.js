// src/components/fluid/webgl/shaders.js

/**
 * GLSL source for the base vertex shader used in all fluid simulation passes.
 * @type {string}
 */
export const baseVertexShaderSource = `
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

/**
 * GLSL source for the copy fragment shader (copies a texture to the target).
 * @type {string}
 */
export const copyShaderSource = `
  precision mediump float;
  precision mediump sampler2D;
  varying highp vec2 vUv;
  uniform sampler2D uTexture;

  void main () {
      vec4 tex = texture2D(uTexture, vUv);
      gl_FragColor = tex; // Output full RGBA color
  }
`;

/**
 * GLSL source for the clear fragment shader (applies dissipation to a texture).
 * @type {string}
 */
export const clearShaderSource = `
  precision mediump float;
  precision mediump sampler2D;
  varying highp vec2 vUv;
  uniform sampler2D uTexture;
  uniform float value;

  void main () {
      gl_FragColor = value * texture2D(uTexture, vUv);
  }
`;

/**
 * GLSL source for the display fragment shader (renders dye to the screen, with optional shading).
 * @type {string}
 */
export const displayShaderSource = `
  precision highp float;
  precision highp sampler2D;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uTexture;
  uniform vec2 texelSize;

  void main() {
    vec4 color = texture2D(uTexture, vUv);
    #ifdef SHADING
      // Simple shading: darken based on dye intensity
      float shade = 0.7 + 0.3 * (color.r + color.g + color.b) / 3.0;
      color.rgb *= shade;
    #endif
    gl_FragColor = vec4(color.rgb, 1.0);
  }
`;

/**
 * GLSL source for the splat fragment shader (applies a color or velocity splat).
 * @type {string}
 */
export const splatShaderSource = `
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
      p.x *= aspectRatio;
      vec3 splat = exp(-dot(p, p) / radius) * color;
      vec3 base = texture2D(uTarget, vUv).xyz;
      gl_FragColor = vec4(base + splat, 1.0);
  }
`;

/**
 * GLSL source for the advection fragment shader (advects dye or velocity through the velocity field).
 * @type {string}
 */
export const advectionShaderSource = `
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
          vec2 velocity = bilerp(uVelocity, vUv, texelSize).xy;
          // Do NOT invert Y velocity here; let the splat function handle the initial inversion.
          vec2 coord = vUv - dt * velocity * texelSize; // Backtrace coordinate
          vec4 result = bilerp(uSource, coord, dyeTexelSize); // Sample source texture at backtraced coordinate
      #else
          // Hardware linear filtering (if supported and enabled)
          vec2 velocity = texture2D(uVelocity, vUv).xy;
          // Do NOT invert Y velocity here; let the splat function handle the initial inversion.
          vec2 coord = vUv - dt * velocity * texelSize; // Backtrace coordinate
          vec4 result = texture2D(uSource, coord); // Sample source texture
      #endif
      
      // Apply dissipation to make splats fade over time
      float decay = 1.0 + dissipation * dt; // Calculate decay factor
      gl_FragColor = result / decay; // Apply dissipation
  }
`;

/**
 * GLSL source for the divergence fragment shader (computes velocity divergence).
 * @type {string}
 */
export const divergenceShaderSource = `
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
      // Invert the Y component to match our Y-axis inversion
      float div = 0.5 * (R - L - (T - B));
      gl_FragColor = vec4(div, 0.0, 0.0, 1.0); // Store divergence in red channel
  }
`;

/**
 * GLSL source for the curl fragment shader (computes vorticity/curl of the velocity field).
 * @type {string}
 */
export const curlShaderSource = `
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
      float L = texture2D(uVelocity, vL).y;
      float R = texture2D(uVelocity, vR).y;
      float T = texture2D(uVelocity, vT).x;
      float B = texture2D(uVelocity, vB).x;
      
      // Calculate basic curl - simplified for stronger effect
      float basicCurl = (R - L) + (T - B);
      
      // Super-amplify the curl
      float vorticity = basicCurl * 20.0; // Extreme amplification
      
      // Apply a non-linear transformation to enhance even small curls
      float sign = vorticity < 0.0 ? -1.0 : 1.0;
      vorticity = sign * sqrt(abs(vorticity));

      gl_FragColor = vec4(vorticity, 0.0, 0.0, 1.0); // Store curl in red channel
  }
`;

/**
 * GLSL source for the vorticity fragment shader (applies vorticity confinement force).
 * @type {string}
 */
export const vorticityShaderSource = `
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
      
      // ALWAYS apply vorticity confinement regardless of curl magnitude
      // Calculate the gradient of the absolute curl magnitude
      vec2 force = vec2(abs(T) - abs(B), -(abs(R) - abs(L)));
      
      // Normalize the force vector (avoid division by zero)
      float lengthSquared = max(0.0001, dot(force, force));
      force = force * inversesqrt(lengthSquared);
      
      // Cross product with curl direction (positive or negative)
      force = vec2(-force.y, force.x) * sign(C);
      
      // Extremely strong curl confinement force
      force *= curl * abs(C) * 5.0; // 5x stronger than before
      
      // Get current velocity
      vec2 velocity = texture2D(uVelocity, vUv).xy;
      
      // Add the vorticity confinement force to the velocity (scaled by dt)
      velocity += force * dt;
      
      // Clamping with higher limits for more dramatic effects
      velocity = min(max(velocity, -2000.0), 2000.0);
      
      gl_FragColor = vec4(velocity, 0.0, 1.0); // Output updated velocity
  }
`;

/**
 * GLSL source for the pressure fragment shader (Jacobi iteration for pressure solve).
 * @type {string}
 */
export const pressureShaderSource = `
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

/**
 * GLSL source for the gradient subtraction fragment shader (makes velocity field divergence-free).
 * @type {string}
 */
export const gradientSubtractShaderSource = `
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
      // Remove Y inversion: do not negate (T - B)
      velocity.xy -= vec2(R - L, T - B); // Subtract scaled gradient without Y inversion

      gl_FragColor = vec4(velocity, 0.0, 1.0); // Output divergence-free velocity
  }
`;
