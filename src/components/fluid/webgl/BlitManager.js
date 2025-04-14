// src/components/fluid/webgl/BlitManager.js

/**
 * Creates a blit function for rendering to the screen or framebuffer
 * @param {WebGLRenderingContext} gl - The WebGL context
 * @returns {Object} An object containing the blit function and resources for cleanup
 */
export function createBlitFunction(gl) {
  // Create vertex buffer for a quad
  const quadVertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadVertexBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), // Quad vertices
    gl.STATIC_DRAW
  );

  // Create index buffer for the quad
  const quadIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, quadIndexBuffer);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array([0, 1, 2, 0, 2, 3]), // Quad indices
    gl.STATIC_DRAW
  );

  // Set up vertex attributes
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);

  // Unbind buffers after setup
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  // Keep ELEMENT_ARRAY_BUFFER bound as it's needed for drawElements

  // The blit function
  const blit = (target, clear = false) => {
    if (target == null) {
      // Blitting to canvas
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    } else {
      // Blitting to FBO
      gl.viewport(0, 0, target.width, target.height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      if (clear) {
        // Only clear if explicitly requested
        gl.clearColor(0.0, 0.0, 0.0, 1.0); // Clear FBOs to black
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
    }
    
    // Bind necessary buffers and draw
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVertexBuffer);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, quadIndexBuffer);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  };

  // Return the blit function and resources for cleanup
  return {
    blit,
    resources: {
      quadVertexBuffer,
      quadIndexBuffer
    },
    dispose: () => {
      gl.deleteBuffer(quadVertexBuffer);
      gl.deleteBuffer(quadIndexBuffer);
    }
  };
}
