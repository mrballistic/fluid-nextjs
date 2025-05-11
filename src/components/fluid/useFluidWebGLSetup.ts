import { useEffect, useState } from 'react';
import {
  compileShader,
  Program
} from './webgl/ShaderManager.js';
import * as shaders from './webgl/shaders.js';
import { createDoubleFBO, createFBO } from './webgl/FramebufferManager.js';
import WebGLContextManager from './webgl/WebGLContextManager.js';
import type { DoubleFBO } from './FluidComponentCorePart1';

interface UseFluidWebGLSetupParams {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  canvasSize: { width: number; height: number };
}

interface UseFluidWebGLSetupResult {
  glCtx: WebGL2RenderingContext | WebGLRenderingContext | null;
  programs: {
    copyProgram: Program;
    advectionProgram: Program;
    divergenceProgram: Program;
    curlProgram: Program;
    vorticityProgram: Program;
    pressureProgram: Program;
    gradientSubtractProgram: Program;
    clearProgram: Program;
    splatProgram: Program;
  } | null;
  fbos: {
    dye: DoubleFBO;
    velocity: DoubleFBO;
    pressure: DoubleFBO;
    divergence: WebGLFramebuffer;
    curl: WebGLFramebuffer;
  } | null;
  blit: (targetFBO: null | DoubleFBO | { fbo: WebGLFramebuffer; width: number; height: number }) => void;
  aPosition: number;
  quadBuffer: WebGLBuffer | null;
}

export function useFluidWebGLSetup({
  canvasRef,
  canvasSize,
}: UseFluidWebGLSetupParams): UseFluidWebGLSetupResult {
  const [state, setState] = useState<UseFluidWebGLSetupResult>({
    glCtx: null,
    programs: null,
    fbos: null,
    blit: () => {},
    aPosition: -1,
    quadBuffer: null,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const params: WebGLContextAttributes = {
      alpha: true,
      depth: false,
      stencil: false,
      antialias: false,
      preserveDrawingBuffer: false,
    };
    const gl = canvas.getContext('webgl2', params) || canvas.getContext('webgl', params);
    if (
      !gl ||
      !(gl instanceof WebGLRenderingContext || (window.WebGL2RenderingContext && gl instanceof window.WebGL2RenderingContext))
    ) {
      console.error('WebGL not supported in this browser.');
      return;
    }
    const glContext = gl as WebGL2RenderingContext | WebGLRenderingContext;

    const isWebGL2 = gl instanceof WebGL2RenderingContext;
    if (isWebGL2) {
      (gl as WebGL2RenderingContext).getExtension('EXT_color_buffer_float');
    } else {
      (gl as WebGLRenderingContext).getExtension('OES_texture_half_float');
    }
    glContext.clearColor(0, 0, 0, 1);
    glContext.clear(glContext.COLOR_BUFFER_BIT);

    const baseVertexShader = compileShader(
      glContext,
      glContext.VERTEX_SHADER,
      shaders.baseVertexShaderSource
    );
    if (!baseVertexShader) {
      console.error('Base vertex shader failed to compile');
      return;
    }
    const copyFragmentShader = compileShader(
      glContext,
      glContext.FRAGMENT_SHADER,
      shaders.copyShaderSource
    );
    if (!copyFragmentShader) {
      console.error('Copy fragment shader failed to compile');
      return;
    }
    const copyProgram = new Program(glContext, baseVertexShader, copyFragmentShader);
    copyProgram.bind();

    const quadVerts = new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      -1, 1,
      1, -1,
      1, 1,
    ]);
    const quadBuffer = glContext.createBuffer();
    glContext.bindBuffer(glContext.ARRAY_BUFFER, quadBuffer);
    glContext.bufferData(glContext.ARRAY_BUFFER, quadVerts, glContext.STATIC_DRAW);
    const aPosition = glContext.getAttribLocation(copyProgram.program, 'aPosition');
    glContext.enableVertexAttribArray(aPosition);
    glContext.vertexAttribPointer(aPosition, 2, glContext.FLOAT, false, 0, 0);

    const ctxInfo = WebGLContextManager.getWebGLContext(canvas);
    if (!ctxInfo) {
      console.error('Failed to get WebGL context and formats.');
      return;
    }
    const { gl: glCtx, ext } = ctxInfo;
    interface WebGLExtensions {
      formatRGBA: { internalFormat: GLenum; format: GLenum };
      formatRG: { internalFormat: GLenum; format: GLenum };
      formatR: { internalFormat: GLenum; format: GLenum };
      halfFloatTexType: GLenum;
      supportLinearFiltering?: boolean;
    }
    const typedExt = ext as WebGLExtensions;
    const supportLinearFiltering = 'supportLinearFiltering' in typedExt ? typedExt.supportLinearFiltering! : false;
    const { formatRGBA, formatRG, formatR, halfFloatTexType } = typedExt;

    const simWidth = 128;
    const simHeight = 128;
    const dyeWidth = 1440;
    const dyeHeight = 1440;

    const dye = createDoubleFBO(glCtx, dyeWidth, dyeHeight, formatRGBA.internalFormat, formatRGBA.format, halfFloatTexType, glCtx.LINEAR) as DoubleFBO;
    dye.texelSizeX = 1.0 / dyeWidth;
    dye.texelSizeY = 1.0 / dyeHeight;

    const internalFormatRG = (glCtx as WebGL2RenderingContext).RG16F ?? formatRG.internalFormat;
    const velocity = createDoubleFBO(glCtx, simWidth, simHeight, internalFormatRG, formatRG.format, halfFloatTexType, glCtx.NEAREST) as DoubleFBO;
    velocity.texelSizeX = 1.0 / simWidth;
    velocity.texelSizeY = 1.0 / simHeight;

    const pressure = createDoubleFBO(glCtx, simWidth, simHeight, formatR.internalFormat, formatR.format, halfFloatTexType, glCtx.NEAREST) as DoubleFBO;
    const divergence = createFBO(glCtx, simWidth, simHeight, formatR.internalFormat, formatR.format, halfFloatTexType, glCtx.NEAREST)!;
    const curl = createFBO(glCtx, simWidth, simHeight, formatR.internalFormat, formatR.format, halfFloatTexType, glCtx.NEAREST)!;

    if (!velocity || !dye || !pressure || !divergence || !curl) {
      console.error('Failed to create one or more simulation FBOs.');
      return;
    }

    const advectionProgram = new Program(
      glCtx,
      baseVertexShader,
      compileShader(
        glCtx,
        glCtx.FRAGMENT_SHADER,
        shaders.advectionShaderSource,
        supportLinearFiltering ? null : ['MANUAL_FILTERING']
      )
    );
    const divergenceProgram = new Program(glCtx, baseVertexShader, compileShader(glCtx, glCtx.FRAGMENT_SHADER, shaders.divergenceShaderSource));
    const curlProgram = new Program(glCtx, baseVertexShader, compileShader(glCtx, glCtx.FRAGMENT_SHADER, shaders.curlShaderSource));
    const vorticityProgram = new Program(glCtx, baseVertexShader, compileShader(glCtx, glCtx.FRAGMENT_SHADER, shaders.vorticityShaderSource));
    const pressureProgram = new Program(glCtx, baseVertexShader, compileShader(glCtx, glCtx.FRAGMENT_SHADER, shaders.pressureShaderSource));
    const gradientSubtractProgram = new Program(glCtx, baseVertexShader, compileShader(glCtx, glCtx.FRAGMENT_SHADER, shaders.gradientSubtractShaderSource));
    const clearProgram = new Program(glCtx, baseVertexShader, compileShader(glCtx, glCtx.FRAGMENT_SHADER, shaders.clearShaderSource));
    const splatProgram = new Program(glCtx, baseVertexShader, compileShader(glCtx, glCtx.FRAGMENT_SHADER, shaders.splatShaderSource));

    function isFBOWithSize(obj: { fbo?: WebGLFramebuffer; width?: number; height?: number }): obj is { fbo: WebGLFramebuffer; width: number; height: number } {
      return (
        obj &&
        typeof obj === 'object' &&
        'fbo' in obj &&
        obj.fbo instanceof WebGLFramebuffer &&
        'width' in obj &&
        typeof obj.width === 'number' &&
        'height' in obj &&
        typeof obj.height === 'number'
      );
    }

    function blit(targetFBO: null | DoubleFBO | { fbo: WebGLFramebuffer; width: number; height: number }) {
      let framebuffer: WebGLFramebuffer | null = null;
      let w = canvasSize.width;
      let h = canvasSize.height;
      if (targetFBO && typeof targetFBO === 'object') {
        if ('write' in targetFBO && typeof (targetFBO as DoubleFBO).write === 'object') {
          framebuffer = (targetFBO as DoubleFBO).write.fbo;
          w = (targetFBO as DoubleFBO).width;
          h = (targetFBO as DoubleFBO).height;
        } else if (isFBOWithSize(targetFBO)) {
          framebuffer = targetFBO.fbo;
          w = targetFBO.width;
          h = targetFBO.height;
        }
      }
      glCtx.bindFramebuffer(glCtx.FRAMEBUFFER, framebuffer);
      glCtx.viewport(0, 0, w, h);
      glCtx.bindBuffer(glCtx.ARRAY_BUFFER, quadBuffer);
      glCtx.enableVertexAttribArray(aPosition);
      glCtx.vertexAttribPointer(aPosition, 2, glCtx.FLOAT, false, 0, 0);
      glCtx.drawArrays(glCtx.TRIANGLES, 0, 6);
    }

    setState({
      glCtx,
      programs: {
        copyProgram,
        advectionProgram,
        divergenceProgram,
        curlProgram,
        vorticityProgram,
        pressureProgram,
        gradientSubtractProgram,
        clearProgram,
        splatProgram,
      },
      fbos: {
        dye,
        velocity,
        pressure,
        divergence,
        curl,
      },
      blit,
      aPosition,
      quadBuffer,
    });
  }, [canvasRef, canvasSize]);

  return state;
}
