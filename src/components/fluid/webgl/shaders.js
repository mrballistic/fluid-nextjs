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
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uTexture;
  uniform sampler2D uVelocity;
  uniform sampler2D uCurl;
  uniform vec2 texelSize;

  void main() {
    // Sample the dye texture (base color)
    vec4 baseColor = texture2D(uTexture, vUv);
    
    // Sample velocity and curl for visualization
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    float curl = texture2D(uCurl, vUv).x;
    
    // Calculate velocity magnitude
    float speed = length(velocity);
    
    // Reduce the intensity of the dye color to make visualization more visible
    vec3 dyeColor = baseColor.rgb * 0.3;
    
    // Visualize curl with color overlay - make it more prominent
    vec3 curlColor = vec3(0.0);
    if (curl > 0.0) {
      curlColor = vec3(1.0, 0.0, 0.0) * min(curl * 5.0, 1.0); // Red for positive curl
    } else {
      curlColor = vec3(0.0, 0.0, 1.0) * min(abs(curl) * 5.0, 1.0); // Blue for negative curl
    }
    
    // Visualize velocity with green overlay - make it more prominent
    vec3 velocityColor = vec3(0.0, 1.0, 0.0) * min(speed * 0.05, 1.0);
    
    // Combine colors with emphasis on visualization rather than dye
    vec3 finalColor = dyeColor + curlColor + velocityColor;
    
    // Ensure we don't exceed 1.0 in any channel
    finalColor = min(finalColor, vec3(1.0));
    
    // Ensure alpha is 1.0 for full opacity
    gl_FragColor = vec4(finalColor, 1.0);
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
      
      // Apply dissipation to make splats fade over time
      float decay = 1.0 + dissipation * dt; // Calculate decay factor
      gl_FragColor = result / decay; // Apply dissipation
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
      // Sample velocity components from neighbors with wider stencil
      float L = texture2D(uVelocity, vL).y;
      float R = texture2D(uVelocity, vR).y;
      float T = texture2D(uVelocity, vT).x;
      float B = texture2D(uVelocity, vB).x;
      
      // Sample additional points for a more accurate curl calculation
      vec2 vL2 = vUv - vec2(2.0 * (vL.x - vUv.x), 0.0);
      vec2 vR2 = vUv + vec2(2.0 * (vR.x - vUv.x), 0.0);
      vec2 vT2 = vUv + vec2(0.0, 2.0 * (vT.y - vUv.y));
      vec2 vB2 = vUv - vec2(0.0, 2.0 * (vUv.y - vB.y));
      
      float L2 = texture2D(uVelocity, vL2).y;
      float R2 = texture2D(uVelocity, vR2).y;
      float T2 = texture2D(uVelocity, vT2).x;
      float B2 = texture2D(uVelocity, vB2).x;
      
      // Calculate curl with higher-order finite difference
      // This gives a more accurate approximation of the curl
      float vorticity = ((8.0 * R - 8.0 * L) - (R2 - L2)) / 12.0 - 
                        ((8.0 * T - 8.0 * B) - (T2 - B2)) / 12.0;
      
      // Amplify the curl value to make it more visible
      vorticity *= 2.0;

      gl_FragColor = vec4(vorticity, 0.0, 0.0, 1.0); // Store curl in red channel
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
      
      // Only apply vorticity confinement where curl is significant
      if (abs(C) > 0.01) {
          // Calculate the gradient of the absolute curl magnitude
          vec2 force = vec2(abs(T) - abs(B), abs(R) - abs(L));
          
          // Normalize the force vector (avoid division by zero)
          float lengthSquared = max(0.0001, dot(force, force));
          force = force * inversesqrt(lengthSquared);
          
          // Cross product with curl direction (positive or negative)
          force = vec2(force.y, -force.x) * sign(C);
          
          // Apply curl confinement force, scaled by the center curl value and strength parameter
          force *= curl * abs(C);
          
          // Get current velocity
          vec2 velocity = texture2D(uVelocity, vUv).xy;
          
          // Add the vorticity confinement force to the velocity (scaled by dt)
          velocity += force * dt;
          
          // Clamp velocity to prevent instability
          velocity = min(max(velocity, -1000.0), 1000.0);
          
          gl_FragColor = vec4(velocity, 0.0, 1.0); // Output updated velocity
      } else {
          // If curl is too small, just pass through the original velocity
          gl_FragColor = texture2D(uVelocity, vUv);
      }
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
