// src/components/fluid/webgl/shaders.js

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

export const copyShaderSource = `
  precision mediump float;
  precision mediump sampler2D;
  varying highp vec2 vUv;
  uniform sampler2D uTexture;

  void main () {
      gl_FragColor = texture2D(uTexture, vUv);
  }
`;

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

export const displayShaderSource = `
  precision highp float;
  precision highp sampler2D;
  varying vec2 vUv;
  uniform sampler2D uTexture;

  void main() {
    vec4 baseColor = texture2D(uTexture, vUv);
    // Apply a more moderate color enhancement
    baseColor.rgb *= 1.2;
    // Ensure we don't exceed 1.0 in any channel
    baseColor.rgb = min(baseColor.rgb, vec3(1.0));
    // Ensure alpha is 1.0 for full opacity
    gl_FragColor = vec4(baseColor.rgb, 1.0);
  }
`;

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
          vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize; // Backtrace coordinate
          vec4 result = bilerp(uSource, coord, dyeTexelSize); // Sample source texture at backtraced coordinate
      #else
          // Hardware linear filtering (if supported and enabled)
          vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize; // Backtrace coordinate
          vec4 result = texture2D(uSource, coord); // Sample source texture
      #endif
      
      // IMPORTANT: Completely disable dissipation to make splats persist
      // float decay = 1.0 + dissipation * dt; // Calculate decay factor
      // gl_FragColor = result / decay; // Apply dissipation
      
      // Instead, just output the result directly without any dissipation
      gl_FragColor = result;
  }
`;

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
      float div = 0.5 * (R - L + T - B);
      gl_FragColor = vec4(div, 0.0, 0.0, 1.0); // Store divergence in red channel
  }
`;

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
      // This might be intentional scaling or assumes a different formulation. Let's stick to it.
      velocity.xy -= vec2(R - L, T - B); // Subtract scaled gradient

      gl_FragColor = vec4(velocity, 0.0, 1.0); // Output divergence-free velocity
  }
`;
