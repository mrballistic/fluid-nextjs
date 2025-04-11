// src/webgl/WebGLContextManager.js

/**
 * Checks if a specific WebGL texture format is supported for rendering.
 * @param {WebGL2RenderingContext | WebGLRenderingContext} gl - The WebGL rendering context.
 * @param {GLenum} internalFormat - The internal format of the texture.
 * @param {GLenum} format - The format of the texel data.
 * @param {GLenum} type - The data type of the texel data.
 * @returns {boolean} True if the format is supported, false otherwise.
 */
const supportRenderTextureFormat = (gl, internalFormat, format, type) => {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0
  );
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

  // Clean up WebGL objects
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); // Unbind FBO before deleting
  gl.deleteFramebuffer(fbo);
  gl.bindTexture(gl.TEXTURE_2D, null); // Unbind texture before deleting
  gl.deleteTexture(texture);


  return status === gl.FRAMEBUFFER_COMPLETE;
};

/**
 * Gets the best supported WebGL texture format for a given internal format.
 * Falls back to alternatives if the preferred format is not supported.
 * @param {WebGL2RenderingContext | WebGLRenderingContext} gl - The WebGL rendering context.
 * @param {GLenum} internalFormat - The desired internal format.
 * @param {GLenum} format - The desired format.
 * @param {GLenum} type - The desired data type.
 * @returns {{internalFormat: GLenum, format: GLenum} | null} The supported format object or null if none found.
 */
const getSupportedFormat = (gl, internalFormat, format, type) => {
  if (!supportRenderTextureFormat(gl, internalFormat, format, type)) {
    // Ensure constants are available before using them
    const R16F = gl.R16F || 0x822A; // Example fallback value if not defined
    const RG16F = gl.RG16F || 0x822B;
    const RGBA16F = gl.RGBA16F || 0x881A;
    const RG = gl.RG || 0x8227;
    const RGBA = gl.RGBA || 0x1908;

    switch (internalFormat) {
      case R16F:
        return getSupportedFormat(gl, RG16F, RG, type); // Fallback to RG16F
      case RG16F:
        return getSupportedFormat(gl, RGBA16F, RGBA, type); // Fallback to RGBA16F
      default:
        console.warn(`Unsupported internal format ${internalFormat} with no fallback.`);
        return null; // No fallback available
    }
  }
  return {
    internalFormat,
    format,
  };
};

/**
 * Manages the WebGL context and its extensions.
 */
class WebGLContextManager {
  /**
   * Creates a WebGL context and retrieves supported extensions and formats.
   * @param {HTMLCanvasElement} canvas - The canvas element to get the context from.
   * @returns {{gl: WebGL2RenderingContext | WebGLRenderingContext, ext: object, isWebGL2: boolean} | null} Context object or null on failure.
   */
  static getWebGLContext(canvas) {
    const params = {
      alpha: true,
      depth: false,
      stencil: false,
      antialias: false,
      preserveDrawingBuffer: false,
    };
    let gl = canvas.getContext("webgl2", params);
    const isWebGL2 = !!gl;
    if (!isWebGL2)
      gl =
        canvas.getContext("webgl", params) ||
        canvas.getContext("experimental-webgl", params);
    if (!gl) {
      console.error("Failed to get WebGL context.");
      return null;
    }

    let halfFloat;
    let supportLinearFiltering;
    if (isWebGL2) {
      gl.getExtension("EXT_color_buffer_float");
      supportLinearFiltering = gl.getExtension("OES_texture_float_linear");
    } else {
      halfFloat = gl.getExtension("OES_texture_half_float");
      supportLinearFiltering = gl.getExtension("OES_texture_half_float_linear");
    }
    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    // Ensure HALF_FLOAT constant is available
    const HALF_FLOAT_TYPE = gl.HALF_FLOAT || (halfFloat && halfFloat.HALF_FLOAT_OES);
    if (!HALF_FLOAT_TYPE) {
        console.error("Half float texture type not supported.");
        return null;
    }

    let formatRGBA;
    let formatRG;
    let formatR;

    // Define constants safely
    const RGBA16F = gl.RGBA16F || 0x881A;
    const RGBA = gl.RGBA || 0x1908;
    const RG16F = gl.RG16F || 0x822B;
    const RG = gl.RG || 0x8227;
    const R16F = gl.R16F || 0x822A;
    const RED = gl.RED || 0x1903;


    if (isWebGL2) {
      formatRGBA = getSupportedFormat(gl, RGBA16F, RGBA, HALF_FLOAT_TYPE);
      formatRG = getSupportedFormat(gl, RG16F, RG, HALF_FLOAT_TYPE);
      formatR = getSupportedFormat(gl, R16F, RED, HALF_FLOAT_TYPE);
    } else {
      // WebGL1 fallback - uses RGBA for all formats if available
      formatRGBA = getSupportedFormat(gl, RGBA, RGBA, HALF_FLOAT_TYPE);
      formatRG = formatRGBA; // Use the same RGBA format for RG
      formatR = formatRGBA;  // Use the same RGBA format for R
    }

    if (!formatRGBA || !formatRG || !formatR) {
        console.error("Required texture formats not supported.");
        return null; // Indicate failure
    }


    return {
      gl,
      ext: {
        formatRGBA,
        formatRG,
        formatR,
        halfFloatTexType: HALF_FLOAT_TYPE,
        supportLinearFiltering,
      },
      isWebGL2, // Expose the WebGL version flag
    };
  }
}

export default WebGLContextManager;
