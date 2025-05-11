// src/components/fluid/utils.js

/**
 * Calculates the framebuffer resolution for the fluid simulation based on the desired resolution and WebGL context.
 * Ensures the aspect ratio is preserved and the minimum/maximum dimensions are set appropriately.
 * @param {number} resolution - The base resolution (e.g., 512)
 * @param {WebGLRenderingContext | WebGL2RenderingContext} gl - The WebGL context
 * @returns {{ width: number, height: number }} The calculated width and height
 */
export const getResolution = (resolution, gl) => {
  if (!gl) return { width: 0, height: 0 };
  let aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
  if (aspectRatio < 1) aspectRatio = 1.0 / aspectRatio;
  const min = Math.round(resolution);
  const max = Math.round(resolution * aspectRatio);
  if (gl.drawingBufferWidth > gl.drawingBufferHeight)
    return { width: max, height: min };
  else return { width: min, height: max };
};

/**
 * Adjusts the splat radius based on the canvas aspect ratio so that splats appear circular.
 * @param {number} radius - The original splat radius
 * @param {WebGLRenderingContext | WebGL2RenderingContext} gl - The WebGL context
 * @returns {number} The corrected radius
 */
export const correctRadius = (radius, gl) => {
  if (!gl) return radius;
  
  // Adjust radius based on aspect ratio
  // This ensures splats appear circular regardless of canvas dimensions
  let aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
  
  // If width > height, increase radius proportionally to width
  // If height > width, no adjustment needed (or adjust based on your preference)
  if (aspectRatio > 1) {
    radius *= aspectRatio;
  }
  
  return radius;
};
