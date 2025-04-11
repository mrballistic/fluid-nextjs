// src/webgl/FramebufferManager.js

/**
 * Creates a single Framebuffer Object (FBO) with an attached texture.
 * @param {WebGL2RenderingContext | WebGLRenderingContext} gl - The WebGL context.
 * @param {number} w - Width of the FBO.
 * @param {number} h - Height of the FBO.
 * @param {GLenum} internalFormat - Internal format of the texture.
 * @param {GLenum} format - Format of the texture.
 * @param {GLenum} type - Data type of the texture.
 * @param {GLenum} param - Texture filtering parameter (e.g., gl.NEAREST, gl.LINEAR).
 * @returns {object | null} An FBO object with texture, fbo, dimensions, texel size, attach, and dispose methods, or null on failure.
 */
const createFBO = (gl, w, h, internalFormat, format, type, param) => {
  gl.activeTexture(gl.TEXTURE0); // Work on texture unit 0
  let texture = gl.createTexture();
  if (!texture) {
    console.error("Failed to create texture object.");
    return null; // Return null or handle error appropriately
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

  let fbo = gl.createFramebuffer();
  if (!fbo) {
    console.error("Failed to create framebuffer object.");
    gl.deleteTexture(texture); // Clean up created texture
    return null;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0, // Attach texture to the color attachment point
    gl.TEXTURE_2D,
    texture,
    0 // Mipmap level
  );

  // Check FBO status
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
      console.error(`Framebuffer incomplete: ${status.toString(16)}`);
      gl.deleteFramebuffer(fbo);
      gl.deleteTexture(texture);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); // Unbind
      gl.bindTexture(gl.TEXTURE_2D, null); // Unbind
      return null;
  }


  gl.viewport(0, 0, w, h); // Set viewport to FBO size
  gl.clear(gl.COLOR_BUFFER_BIT); // Clear the FBO

  let texelSizeX = 1.0 / w;
  let texelSizeY = 1.0 / h;

  // Unbind FBO and texture to prevent accidental modification
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);


  return {
    texture,
    fbo,
    width: w,
    height: h,
    texelSizeX,
    texelSizeY,
    /**
     * Attaches the FBO's texture to a specified texture unit.
     * @param {number} id - The texture unit ID (e.g., 0 for TEXTURE0).
     * @returns {number} The texture unit ID.
     */
    attach(id) {
      gl.activeTexture(gl.TEXTURE0 + id);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      return id;
    },
    /**
     * Deletes the WebGL texture and framebuffer resources.
     */
    dispose() {
      gl.deleteTexture(texture);
      gl.deleteFramebuffer(fbo);
      // Nullify references to prevent reuse after disposal
      this.texture = null;
      this.fbo = null;
    },
  };
};

/**
 * Creates a double Framebuffer Object (Double FBO) for ping-pong rendering techniques.
 * @param {WebGL2RenderingContext | WebGLRenderingContext} gl - The WebGL context.
 * @param {number} w - Width of the FBOs.
 * @param {number} h - Height of the FBOs.
 * @param {GLenum} internalFormat - Internal format of the textures.
 * @param {GLenum} format - Format of the textures.
 * @param {GLenum} type - Data type of the textures.
 * @param {GLenum} param - Texture filtering parameter.
 * @returns {object | null} A Double FBO object with read/write FBOs, dimensions, texel size, swap, and dispose methods, or null on failure.
 */
const createDoubleFBO = (gl, w, h, internalFormat, format, type, param) => {
  let fbo1 = createFBO(gl, w, h, internalFormat, format, type, param);
  let fbo2 = createFBO(gl, w, h, internalFormat, format, type, param);

  if (!fbo1 || !fbo2) {
      console.error("Failed to create one or both FBOs for double FBO setup.");
      // Clean up partially created FBOs
      if (fbo1) fbo1.dispose();
      if (fbo2) fbo2.dispose();
      return null;
  }


  return {
    width: w,
    height: h,
    texelSizeX: fbo1.texelSizeX,
    texelSizeY: fbo1.texelSizeY,
    /** @type {object} The FBO currently used for reading. */
    get read() {
      return fbo1;
    },
    set read(value) {
      fbo1 = value;
    },
    /** @type {object} The FBO currently used for writing. */
    get write() {
      return fbo2;
    },
    set write(value) {
      fbo2 = value;
    },
    /**
     * Swaps the read and write FBOs.
     */
    swap() {
      let temp = fbo1;
      fbo1 = fbo2;
      fbo2 = temp;
    },
    /**
     * Disposes both FBOs in the double FBO setup.
     */
    dispose() {
      if (fbo1) fbo1.dispose();
      if (fbo2) fbo2.dispose();
      // Nullify references
      fbo1 = null;
      fbo2 = null;
    },
  };
};

/**
 * Resizes a single FBO. Creates a new FBO with the target dimensions and disposes the old one.
 * @param {WebGL2RenderingContext | WebGLRenderingContext} gl - The WebGL context.
 * @param {object} targetFBO - The FBO object to resize.
 * @param {number} w - New width.
 * @param {number} h - New height.
 * @param {GLenum} internalFormat - Internal format for the new texture.
 * @param {GLenum} format - Format for the new texture.
 * @param {GLenum} type - Data type for the new texture.
 * @param {GLenum} param - Texture filtering parameter for the new texture.
 * @returns {object | null} The new FBO object or null on failure.
 */
const resizeFBO = (gl, targetFBO, w, h, internalFormat, format, type, param) => {
  // Check if resize is necessary
  if (targetFBO && targetFBO.width === w && targetFBO.height === h) {
      return targetFBO;
  }

  const newFBO = createFBO(gl, w, h, internalFormat, format, type, param);
  if (!newFBO) {
      console.error("Failed to create new FBO during resize.");
      return targetFBO; // Return the original FBO if creation fails
  }

  // Dispose the old FBO only if it exists
  if (targetFBO) {
      targetFBO.dispose();
  }

  return newFBO;
};


/**
 * Resizes a Double FBO. Creates new FBOs for read and write buffers with the target dimensions.
 * @param {WebGL2RenderingContext | WebGLRenderingContext} gl - The WebGL context.
 * @param {object} targetDoubleFBO - The Double FBO object to resize.
 * @param {number} w - New width.
 * @param {number} h - New height.
 * @param {GLenum} internalFormat - Internal format for the new textures.
 * @param {GLenum} format - Format for the new textures.
 * @param {GLenum} type - Data type for the new textures.
 * @param {GLenum} param - Texture filtering parameter for the new textures.
 * @returns {object} The resized Double FBO object.
 */
const resizeDoubleFBO = (
  gl,
  targetDoubleFBO,
  w,
  h,
  internalFormat,
  format,
  type,
  param
) => {
  // Check if resize is necessary
  if (targetDoubleFBO.width === w && targetDoubleFBO.height === h) {
    return targetDoubleFBO;
  }

  // Dispose old FBOs before creating new ones
  // Ensure read/write properties exist before trying to dispose
  if (targetDoubleFBO.read) {
      targetDoubleFBO.read.dispose();
  }
  if (targetDoubleFBO.write) {
      targetDoubleFBO.write.dispose();
  }


  // Create new FBOs for the double FBO
  const newReadFBO = createFBO(gl, w, h, internalFormat, format, type, param);
  const newWriteFBO = createFBO(gl, w, h, internalFormat, format, type, param);

  if (!newReadFBO || !newWriteFBO) {
      console.error("Failed to create new FBOs during double FBO resize.");
      // Attempt to clean up if one was created
      if (newReadFBO) newReadFBO.dispose();
      if (newWriteFBO) newWriteFBO.dispose();
      // Return the original object might be problematic, maybe return null or throw
      // For now, returning the original to avoid breaking flow, but indicates failure
      return targetDoubleFBO;
  }


  // Update the target Double FBO object in place
  targetDoubleFBO.read = newReadFBO;
  targetDoubleFBO.write = newWriteFBO;
  targetDoubleFBO.width = w;
  targetDoubleFBO.height = h;
  targetDoubleFBO.texelSizeX = 1.0 / w;
  targetDoubleFBO.texelSizeY = 1.0 / h;

  return targetDoubleFBO;
};

export { createFBO, createDoubleFBO, resizeFBO, resizeDoubleFBO };
