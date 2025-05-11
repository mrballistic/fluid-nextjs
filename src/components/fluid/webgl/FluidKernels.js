// src/components/fluid/webgl/FluidKernels.js

/**
 * Fluid simulation kernels - contains functions for each simulation step
 */

/**
 * Advection step - moves quantities through the velocity field.
 * @param {WebGLRenderingContext} gl
 * @param {Object} advectionProgram
 * @param {Object} velocity
 * @param {Object} source
 * @param {Object} target
 * @param {number} dt
 * @param {number} dissipation
 * @param {Function} blit
 */
export function advectionStep(gl, advectionProgram, velocity, source, target, dt, dissipation, blit) {
  advectionProgram.bind();
  gl.uniform2f(advectionProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
  gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read.attach(0));
  gl.uniform1i(advectionProgram.uniforms.uSource, source.read.attach(1));
  gl.uniform1f(advectionProgram.uniforms.dt, dt);
  gl.uniform1f(advectionProgram.uniforms.dissipation, dissipation);
  
  // If source is not velocity, we need to set dyeTexelSize
  if (source !== velocity) {
    gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, source.texelSizeX, source.texelSizeY);
  }
  
  blit(target); // Pass the full target object, not target.write
  target.swap();
}

/**
 * Curl step - calculates the curl (vorticity) of the velocity field.
 * @param {WebGLRenderingContext} gl
 * @param {Object} curlProgram
 * @param {Object} velocity
 * @param {Object} curl
 * @param {Function} blit
 */
export function curlStep(gl, curlProgram, velocity, curl, blit) {
  curlProgram.bind();
  if (curlProgram.uniforms.texelSize) {
    gl.uniform2f(curlProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
  }
  gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read.attach(0));
  blit(curl);
}

/**
 * Vorticity step - applies vorticity confinement to enhance small-scale details.
 * @param {WebGLRenderingContext} gl
 * @param {Object} vorticityProgram
 * @param {Object} velocity
 * @param {Object} curl
 * @param {number} curlStrength
 * @param {number} dt
 * @param {Function} blit
 */
export function vorticityStep(gl, vorticityProgram, velocity, curl, curlStrength, dt, blit) {
  vorticityProgram.bind();
  if (vorticityProgram.uniforms.texelSize) {
    gl.uniform2f(vorticityProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
  }
  gl.uniform1i(vorticityProgram.uniforms.uVelocity, velocity.read.attach(0));
  gl.uniform1i(vorticityProgram.uniforms.uCurl, curl.attach(1));
  gl.uniform1f(vorticityProgram.uniforms.curl, curlStrength);
  gl.uniform1f(vorticityProgram.uniforms.dt, dt);
  blit(velocity); // Pass the full velocity object, not velocity.write
  velocity.swap();
}

/**
 * Divergence step - calculates the divergence of the velocity field.
 * @param {WebGLRenderingContext} gl
 * @param {Object} divergenceProgram
 * @param {Object} velocity
 * @param {Object} divergence
 * @param {Function} blit
 */
export function divergenceStep(gl, divergenceProgram, velocity, divergence, blit) {
  divergenceProgram.bind();
  if (divergenceProgram.uniforms.texelSize) {
    gl.uniform2f(divergenceProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
  }
  gl.uniform1i(divergenceProgram.uniforms.uVelocity, velocity.read.attach(0));
  blit(divergence);
}

/**
 * Clear pressure step - clears the pressure field with dissipation.
 * @param {WebGLRenderingContext} gl
 * @param {Object} clearProgram
 * @param {Object} pressure
 * @param {number} dissipation
 * @param {Function} blit
 */
export function clearPressureStep(gl, clearProgram, pressure, dissipation, blit) {
  clearProgram.bind();
  gl.uniform1i(clearProgram.uniforms.uTexture, pressure.read.attach(0));
  gl.uniform1f(clearProgram.uniforms.value, dissipation);
  blit(pressure); // Pass the full pressure object, not pressure.write
  pressure.swap();
}

/**
 * Pressure step - solves the pressure equation using Jacobi iteration.
 * @param {WebGLRenderingContext} gl
 * @param {Object} pressureProgram
 * @param {Object} pressure
 * @param {Object} divergence
 * @param {number} iterations
 * @param {Function} blit
 */
export function pressureStep(gl, pressureProgram, pressure, divergence, iterations, blit) {
  // Bind program and set static uniforms
  pressureProgram.bind();
  if (pressureProgram.uniforms.texelSize) {
    gl.uniform2f(pressureProgram.uniforms.texelSize, pressure.texelSizeX, pressure.texelSizeY);
  }
  gl.uniform1i(pressureProgram.uniforms.uDivergence, divergence.attach(0));

  for (let i = 0; i < iterations; i++) {
    // Rebind program before setting uniforms in case blit() changed it
    pressureProgram.bind();
    gl.uniform1i(pressureProgram.uniforms.uPressure, pressure.read.attach(1));
    blit(pressure); // Pass the full pressure object, not pressure.write
    pressure.swap();
  }
}

/**
 * Gradient subtraction step - subtracts the pressure gradient from the velocity field.
 * @param {WebGLRenderingContext} gl
 * @param {Object} gradientProgram
 * @param {Object} velocity
 * @param {Object} pressure
 * @param {Function} blit
 */
export function gradientSubtractStep(gl, gradientProgram, velocity, pressure, blit) {
  gradientProgram.bind();
  if (gradientProgram.uniforms.texelSize) {
    gl.uniform2f(gradientProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
  }
  gl.uniform1i(gradientProgram.uniforms.uPressure, pressure.read.attach(0));
  gl.uniform1i(gradientProgram.uniforms.uVelocity, velocity.read.attach(1));
  blit(velocity); // Pass the full velocity object, not velocity.write
  velocity.swap();
}

/**
 * Splat step - adds a splat to the velocity and dye fields.
 * @param {WebGLRenderingContext} gl
 * @param {Object} splatProgram
 * @param {Object} target
 * @param {number} x
 * @param {number} y
 * @param {number} dx
 * @param {number} dy
 * @param {Object} color
 * @param {number} radius
 * @param {Function} blit
 */
export function splatStep(gl, splatProgram, target, x, y, dx, dy, color, radius, blit) {
  splatProgram.bind();
  gl.uniform1i(splatProgram.uniforms.uTarget, target.read.attach(0));
  gl.uniform1f(splatProgram.uniforms.aspectRatio, gl.canvas.width / gl.canvas.height);
  gl.uniform2f(splatProgram.uniforms.point, x, y);
  
  // For velocity splat, color is the velocity
  if (color.r === undefined) {
    gl.uniform3f(splatProgram.uniforms.color, dx, dy, 0.0); // Remove Y inversion for velocity splat
  } else {
    // For dye splat, color is the actual color
    gl.uniform3f(splatProgram.uniforms.color, color.r, color.g, color.b);
  }
  
  gl.uniform1f(splatProgram.uniforms.radius, radius);
  blit(target); // Pass the full target object, not target.write
  target.swap();
}
