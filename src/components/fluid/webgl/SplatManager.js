// src/components/fluid/webgl/SplatManager.js

import { correctRadius } from '../utils.js';

/**
 * Handles splat operations for the fluid simulation
 */

/**
 * Creates a splat in the fluid simulation
 * @param {WebGLRenderingContext} gl - The WebGL context
 * @param {Object} splatProgram - The splat shader program
 * @param {Object} velocity - The velocity field
 * @param {Object} dye - The dye field
 * @param {number} x - The x position of the splat (0-1)
 * @param {number} y - The y position of the splat (0-1)
 * @param {number} dx - The x velocity of the splat
 * @param {number} dy - The y velocity of the splat
 * @param {Object} color - The color of the splat {r, g, b}
 * @param {number} radius - The radius of the splat
 * @param {Function} blit - The blit function
 */
export function createSplat(gl, splatProgram, velocity, dye, x, y, dx, dy, color, radius, blit) {
  if (!gl || !velocity || !dye || !splatProgram || !splatProgram.program) {
    console.error("Cannot splat, required resources missing or program invalid.");
    console.error("GL:", !!gl, "Velocity:", !!velocity, "Dye:", !!dye, 
                 "SplatProgram:", !!splatProgram, 
                 "SplatProgram.program:", splatProgram ? !!splatProgram.program : "N/A");
    return;
  }

  console.log(`SPLAT called at (${x.toFixed(3)}, ${y.toFixed(3)}) with velocity (${dx.toFixed(2)}, ${dy.toFixed(2)}) and color (${color.r.toFixed(2)}, ${color.g.toFixed(2)}, ${color.b.toFixed(2)})`);

  // Amplify the color to make it more visible
  const amplifiedColor = {
    r: color.r * 10.0,
    g: color.g * 10.0,
    b: color.b * 10.0
  };

  // Splat velocity
  gl.viewport(0, 0, velocity.width, velocity.height);
  splatProgram.bind();
  gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read.attach(0));
  gl.uniform1f(splatProgram.uniforms.aspectRatio, gl.canvas.width / gl.canvas.height);
  gl.uniform2f(splatProgram.uniforms.point, x, y); // Normalized coordinates (0-1)
  gl.uniform3f(splatProgram.uniforms.color, dx, -dy, 0.0); // Invert Y velocity here
  
  // Use the provided radius, adjusted for aspect ratio
  const adjustedRadius = correctRadius(radius, gl);
  gl.uniform1f(splatProgram.uniforms.radius, adjustedRadius);
  
  console.log(`Splat Velocity - Point: (${x.toFixed(3)}, ${y.toFixed(3)}), Velocity: (${dx.toFixed(2)}, ${dy.toFixed(2)})`);
  
  blit(velocity.write);
  velocity.swap();

  // Splat dye
  gl.viewport(0, 0, dye.width, dye.height);
  // splatProgram is already bound
  gl.uniform1i(splatProgram.uniforms.uTarget, dye.read.attach(0));
  
  // Use amplified color
  gl.uniform3f(splatProgram.uniforms.color, amplifiedColor.r, amplifiedColor.g, amplifiedColor.b);
  
  // Use the same radius for dye
  gl.uniform1f(splatProgram.uniforms.radius, adjustedRadius);
  
  blit(dye.write); // Draw splat into dye.write
  dye.swap(); // Enable swap to make the splat visible
}

/**
 * Creates a color splat without affecting velocity
 * @param {WebGLRenderingContext} gl - The WebGL context
 * @param {Object} splatProgram - The splat shader program
 * @param {Object} dye - The dye field
 * @param {number} x - The x position of the splat (0-1)
 * @param {number} y - The y position of the splat (0-1)
 * @param {Object} color - The color of the splat {r, g, b}
 * @param {number} radius - The radius of the splat
 * @param {Function} blit - The blit function
 */
export function createColorSplat(gl, splatProgram, dye, x, y, color, radius, blit) {
  if (!gl || !dye || !splatProgram || !splatProgram.program) {
    console.error("Cannot create color splat, required resources missing.");
    return;
  }

  // Amplify the color to make it more visible
  const amplifiedColor = {
    r: color.r * 10.0,
    g: color.g * 10.0,
    b: color.b * 10.0
  };

  // Splat dye only
  gl.viewport(0, 0, dye.width, dye.height);
  splatProgram.bind();
  gl.uniform1i(splatProgram.uniforms.uTarget, dye.read.attach(0));
  gl.uniform1f(splatProgram.uniforms.aspectRatio, gl.canvas.width / gl.canvas.height);
  gl.uniform2f(splatProgram.uniforms.point, x, y);
  gl.uniform3f(splatProgram.uniforms.color, amplifiedColor.r, amplifiedColor.g, amplifiedColor.b);
  gl.uniform1f(splatProgram.uniforms.radius, correctRadius(radius, gl));
  
  blit(dye.write);
  dye.swap();
}

/**
 * Creates a velocity splat without affecting color
 * @param {WebGLRenderingContext} gl - The WebGL context
 * @param {Object} splatProgram - The splat shader program
 * @param {Object} velocity - The velocity field
 * @param {number} x - The x position of the splat (0-1)
 * @param {number} y - The y position of the splat (0-1)
 * @param {number} dx - The x velocity of the splat
 * @param {number} dy - The y velocity of the splat
 * @param {number} radius - The radius of the splat
 * @param {Function} blit - The blit function
 */
export function createVelocitySplat(gl, splatProgram, velocity, x, y, dx, dy, radius, blit) {
  if (!gl || !velocity || !splatProgram || !splatProgram.program) {
    console.error("Cannot create velocity splat, required resources missing.");
    return;
  }

  // Splat velocity only
  gl.viewport(0, 0, velocity.width, velocity.height);
  splatProgram.bind();
  gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read.attach(0));
  gl.uniform1f(splatProgram.uniforms.aspectRatio, gl.canvas.width / gl.canvas.height);
  gl.uniform2f(splatProgram.uniforms.point, x, y);
  gl.uniform3f(splatProgram.uniforms.color, dx, -dy, 0.0); // Invert Y velocity here too
  gl.uniform1f(splatProgram.uniforms.radius, correctRadius(radius, gl));
  
  blit(velocity.write);
  velocity.swap();
}
