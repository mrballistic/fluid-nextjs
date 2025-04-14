// src/components/fluid/webgl/FluidKernels.js

/**
 * Fluid simulation kernels - contains functions for each simulation step
 */

/**
 * Advection step - moves quantities through the velocity field
 * @param {WebGLRenderingContext} gl - The WebGL context
 * @param {Object} advectionProgram - The advection shader program
 * @param {Object} velocity - The velocity field
 * @param {Object} source - The source field to advect (can be velocity itself or dye)
 * @param {Object} target - The target field to write to
 * @param {number} dt - The time step
 * @param {number} dissipation - The dissipation rate
 * @param {Function} blit - The blit function
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
  
  blit(target.write);
  target.swap();
}

/**
 * Curl step - calculates the curl (vorticity) of the velocity field
 * @param {WebGLRenderingContext} gl - The WebGL context
 * @param {Object} curlProgram - The curl shader program
 * @param {Object} velocity - The velocity field
 * @param {Object} curl - The curl field to write to
 * @param {Function} blit - The blit function
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
 * Vorticity step - applies vorticity confinement to enhance small-scale details
 * @param {WebGLRenderingContext} gl - The WebGL context
 * @param {Object} vorticityProgram - The vorticity shader program
 * @param {Object} velocity - The velocity field
 * @param {Object} curl - The curl field
 * @param {number} curlStrength - The curl strength parameter
 * @param {number} dt - The time step
 * @param {Function} blit - The blit function
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
  blit(velocity.write);
  velocity.swap();
}

/**
 * Divergence step - calculates the divergence of the velocity field
 * @param {WebGLRenderingContext} gl - The WebGL context
 * @param {Object} divergenceProgram - The divergence shader program
 * @param {Object} velocity - The velocity field
 * @param {Object} divergence - The divergence field to write to
 * @param {Function} blit - The blit function
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
 * Clear pressure step - clears the pressure field with dissipation
 * @param {WebGLRenderingContext} gl - The WebGL context
 * @param {Object} clearProgram - The clear shader program
 * @param {Object} pressure - The pressure field
 * @param {number} dissipation - The pressure dissipation rate
 * @param {Function} blit - The blit function
 */
export function clearPressureStep(gl, clearProgram, pressure, dissipation, blit) {
  clearProgram.bind();
  gl.uniform1i(clearProgram.uniforms.uTexture, pressure.read.attach(0));
  gl.uniform1f(clearProgram.uniforms.value, dissipation);
  blit(pressure.write);
  pressure.swap();
}

/**
 * Pressure step - solves the pressure equation using Jacobi iteration
 * @param {WebGLRenderingContext} gl - The WebGL context
 * @param {Object} pressureProgram - The pressure shader program
 * @param {Object} pressure - The pressure field
 * @param {Object} divergence - The divergence field
 * @param {number} iterations - The number of iterations
 * @param {Function} blit - The blit function
 */
export function pressureStep(gl, pressureProgram, pressure, divergence, iterations, blit) {
  pressureProgram.bind();
  if (pressureProgram.uniforms.texelSize) {
    gl.uniform2f(pressureProgram.uniforms.texelSize, pressure.texelSizeX, pressure.texelSizeY);
  }
  gl.uniform1i(pressureProgram.uniforms.uDivergence, divergence.attach(0));
  
  for (let i = 0; i < iterations; i++) {
    gl.uniform1i(pressureProgram.uniforms.uPressure, pressure.read.attach(1));
    blit(pressure.write);
    pressure.swap();
  }
}

/**
 * Gradient subtraction step - subtracts the pressure gradient from the velocity field
 * @param {WebGLRenderingContext} gl - The WebGL context
 * @param {Object} gradientProgram - The gradient subtraction shader program
 * @param {Object} velocity - The velocity field
 * @param {Object} pressure - The pressure field
 * @param {Function} blit - The blit function
 */
export function gradientSubtractStep(gl, gradientProgram, velocity, pressure, blit) {
  gradientProgram.bind();
  if (gradientProgram.uniforms.texelSize) {
    gl.uniform2f(gradientProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
  }
  gl.uniform1i(gradientProgram.uniforms.uPressure, pressure.read.attach(0));
  gl.uniform1i(gradientProgram.uniforms.uVelocity, velocity.read.attach(1));
  blit(velocity.write);
  velocity.swap();
}

/**
 * Splat step - adds a splat to the velocity and dye fields
 * @param {WebGLRenderingContext} gl - The WebGL context
 * @param {Object} splatProgram - The splat shader program
 * @param {Object} target - The target field (velocity or dye)
 * @param {number} x - The x position of the splat
 * @param {number} y - The y position of the splat
 * @param {number} dx - The x velocity of the splat
 * @param {number} dy - The y velocity of the splat
 * @param {Object} color - The color of the splat
 * @param {number} radius - The radius of the splat
 * @param {Function} blit - The blit function
 */
export function splatStep(gl, splatProgram, target, x, y, dx, dy, color, radius, blit) {
  splatProgram.bind();
  gl.uniform1i(splatProgram.uniforms.uTarget, target.read.attach(0));
  gl.uniform1f(splatProgram.uniforms.aspectRatio, gl.canvas.width / gl.canvas.height);
  gl.uniform2f(splatProgram.uniforms.point, x, y);
  
  // For velocity splat, color is the velocity
  if (color.r === undefined) {
    gl.uniform3f(splatProgram.uniforms.color, dx, dy, 0.0);
  } else {
    // For dye splat, color is the actual color
    gl.uniform3f(splatProgram.uniforms.color, color.r, color.g, color.b);
  }
  
  gl.uniform1f(splatProgram.uniforms.radius, radius);
  blit(target.write);
  target.swap();
}
