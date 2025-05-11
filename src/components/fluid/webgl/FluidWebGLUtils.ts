// src/components/fluid/webgl/FluidWebGLUtils.ts

export interface FluidWebGLCapabilities {
  isWebGL2: boolean;
  floatRenderable: boolean;
  simInternalFormat: GLenum;
  simType: GLenum;
}

export function detectWebGLCapabilities(gl: WebGLRenderingContext | WebGL2RenderingContext): FluidWebGLCapabilities {
  const isWebGL2 = gl instanceof WebGL2RenderingContext;
  let simInternalFormat: GLenum;
  let simType: GLenum = gl.UNSIGNED_BYTE;
  let floatRenderable = false;

  if (isWebGL2) {
    const colorBufferFloat = (gl as WebGL2RenderingContext).getExtension('EXT_color_buffer_float');
    if (colorBufferFloat) {
      simInternalFormat = (gl as WebGL2RenderingContext).RGBA16F;
      simType = (gl as WebGL2RenderingContext).FLOAT;
      floatRenderable = true;
    } else {
      simInternalFormat = gl.RGBA;
      simType = gl.UNSIGNED_BYTE;
    }
  } else {
    const halfFloatExt = gl.getExtension('OES_texture_half_float');
    const colorBufferHalfFloat = gl.getExtension('EXT_color_buffer_half_float');
    if (halfFloatExt && colorBufferHalfFloat) {
      simType = (halfFloatExt as unknown as { HALF_FLOAT_OES: GLenum }).HALF_FLOAT_OES;
      simInternalFormat = gl.RGBA;
      floatRenderable = true;
    } else {
      simInternalFormat = gl.RGBA;
      simType = gl.UNSIGNED_BYTE;
    }
  }
  return { isWebGL2, floatRenderable, simInternalFormat, simType };
}

export function createSimTextureAndFBO(gl: WebGLRenderingContext | WebGL2RenderingContext, width: number, height: number, simInternalFormat: GLenum, simType: GLenum): { texture: WebGLTexture, fbo: WebGLFramebuffer } {
  const simTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, simTexture);
  if (gl instanceof WebGL2RenderingContext) {
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      simInternalFormat,
      width,
      height,
      0,
      gl.RGBA,
      simType,
      null
    );
  } else {
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      simType,
      null
    );
  }
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const simFBO = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, simFBO);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    simTexture,
    0
  );
  return { texture: simTexture!, fbo: simFBO! };
}
