// src/components/fluid/webgl/RenderManager.js

/**
 * Handles rendering of the fluid simulation
 */

/**
 * Renders the fluid simulation to the screen or a target framebuffer
 * @param {WebGLRenderingContext} gl - The WebGL context
 * @param {Object} displayMaterial - The display material
 * @param {Object} dye - The dye field
 * @param {Object} velocity - The velocity field
 * @param {Object} curl - The curl field
 * @param {Object} target - The target framebuffer (null for screen)
 * @param {Object} config - The fluid configuration
 * @param {Function} blit - The blit function
 * @param {Object} curlProgram - The curl shader program (for fresh curl calculation)
 */
export function renderFluid(gl, displayMaterial, dye, velocity, curl, target, config, blit, curlProgram) {
  // Check if required resources are available
  if (!gl || !dye || !velocity || !curl || !displayMaterial) {
    console.error("Cannot render, required resources missing.");
    return;
  }
  
  // Clear the canvas with the background color if TRANSPARENT is false
  if (target == null && !config.TRANSPARENT) {
    gl.clearColor(
      config.BACK_COLOR.r,
      config.BACK_COLOR.g,
      config.BACK_COLOR.b,
      1.0
    );
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
  
  // Set up blending for rendering - Use additive blending for more intense visualization
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_DST_ALPHA);  // Changed to pure additive blending
  gl.enable(gl.BLEND);

  // Set viewport for rendering
  if (target == null) {
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  } else {
    // Ensure target is a valid FBO-like object
    if (typeof target.width !== 'number' || typeof target.height !== 'number') {
      console.error("Invalid render target provided.");
      return;
    }
    gl.viewport(0, 0, target.width, target.height);
  }

  // Force a curl calculation before rendering to ensure we have fresh curl data
  if (curlProgram) {
    curlProgram.bind();
    if (curlProgram.uniforms.texelSize) {
      gl.uniform2f(curlProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    }
    gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read.attach(0));
    blit(curl);
  }

  // Bind the display material
  displayMaterial.bind();

  // Set uniforms for display shader
  if (displayMaterial.uniforms.texelSize) {
    gl.uniform2f(displayMaterial.uniforms.texelSize, dye.texelSizeX, dye.texelSizeY);
  }
  
  // Attach textures and set uniforms
  gl.uniform1i(displayMaterial.uniforms.uTexture, dye.read.attach(0));
  gl.uniform1i(displayMaterial.uniforms.uVelocity, velocity.read.attach(1));
  gl.uniform1i(displayMaterial.uniforms.uCurl, curl.attach(2));

  // Blit to the target
  blit(target);

  // Disable blending after rendering
  gl.disable(gl.BLEND);
}
