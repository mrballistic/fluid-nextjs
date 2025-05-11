import { useEffect } from 'react';
import * as FluidKernels from './webgl/FluidKernels.js';
import defaultFluidConfigImport from './config/fluidConfig.js';
import type { Splat, DoubleFBO } from './FluidComponentCorePart1';
import { Program } from './webgl/ShaderManager.js';

interface FluidConfig {
  SIM_RESOLUTION: number;
  DYE_RESOLUTION: number;
  CAPTURE_RESOLUTION: number;
  DENSITY_DISSIPATION: number;
  VELOCITY_DISSIPATION: number;
  PRESSURE: number;
  PRESSURE_ITERATIONS: number;
  CURL: number;
  SPLAT_RADIUS: number;
  SPLAT_FORCE: number;
  SHADING: boolean;
  COLORFUL?: boolean;
  COLOR_UPDATE_SPEED: number;
  PAUSED?: boolean;
  BACK_COLOR: { r: number; g: number; b: number };
  TRANSPARENT: boolean;
}

const defaultFluidConfig = defaultFluidConfigImport as unknown as FluidConfig;

/**
 * Parameters for the useFluidSimulationLoop hook.
 */
export interface UseFluidSimulationLoopParams {
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
  canvasSize: { width: number; height: number };
  splatQueue: React.MutableRefObject<Splat[]>;
  originalSplatRadius: number;
}

/**
 * Custom React hook to run the fluid simulation loop and handle rendering.
 */
export function useFluidSimulationLoop({
  glCtx,
  programs,
  fbos,
  blit,
  aPosition,
  quadBuffer,
  canvasSize,
  splatQueue,
  originalSplatRadius,
}: UseFluidSimulationLoopParams): void {
  useEffect(() => {
    if (!glCtx || !programs || !fbos) return;

    let running = true;
    let lastTime = performance.now();

    const {
      copyProgram,
      advectionProgram,
      divergenceProgram,
      curlProgram,
      vorticityProgram,
      pressureProgram,
      gradientSubtractProgram,
      clearProgram,
      splatProgram,
    } = programs;

    const {
      dye,
      velocity,
      pressure,
      divergence,
      curl,
    } = fbos;

    /**
     * Checks if the given object is a framebuffer object with size properties.
     * @param {Object} obj - Object to check
     * @returns {boolean} True if the object is a framebuffer object with size properties, false otherwise
     */
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

    /**
     * Runs a single simulation step, updating all fluid fields.
     * @param {number} dt - Time step in seconds
     */
    function simulationStep(dt: number) {
      if (!glCtx) return;
      FluidKernels.curlStep(glCtx, curlProgram, velocity, curl, blit);
      FluidKernels.vorticityStep(glCtx, vorticityProgram, velocity, curl, defaultFluidConfig.CURL, dt, blit);
      FluidKernels.divergenceStep(glCtx, divergenceProgram, velocity, divergence, blit);
      FluidKernels.clearPressureStep(glCtx, clearProgram, pressure, defaultFluidConfig.PRESSURE, blit);
      FluidKernels.pressureStep(glCtx, pressureProgram, pressure, divergence, defaultFluidConfig.PRESSURE_ITERATIONS, blit);
      FluidKernels.gradientSubtractStep(glCtx, gradientSubtractProgram, velocity, pressure, blit);

      console.log('Velocity FBO size:', velocity.width, velocity.height);
      console.log('Dye FBO size:', dye.width, dye.height);
      console.log('Pressure FBO size:', pressure.width, pressure.height);
      if (isFBOWithSize(divergence)) {
        console.log('Divergence FBO size:', divergence.width, divergence.height);
      } else {
        console.error('Divergence FBO does not have width and height properties.');
      }
      if (isFBOWithSize(curl)) {
        console.log('Curl FBO size:', curl.width, curl.height);
      } else {
        console.error('Curl FBO does not have width and height properties.');
      }
      let err = glCtx.getError();
      if (err !== glCtx.NO_ERROR) {
        console.error('WebGL error before advection:', err);
      }

      FluidKernels.advectionStep(glCtx, advectionProgram, velocity, velocity, velocity, dt, defaultFluidConfig.VELOCITY_DISSIPATION, blit);
      FluidKernels.advectionStep(glCtx, advectionProgram, velocity, dye, dye, dt, defaultFluidConfig.DENSITY_DISSIPATION, blit);

      err = glCtx.getError();
      if (err !== glCtx.NO_ERROR) {
        console.error('WebGL error after advection:', err);
      }
    }

    /**
     * Main render loop for the fluid simulation.
     */
    function renderLoop() {
      if (!glCtx) return;
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.016);
      lastTime = now;

      console.debug('Render loop running, dt:', dt);

      let err: number;

      while (splatQueue.current.length > 0) {
        const splat = splatQueue.current.shift()!;
        console.debug('Processing splat:', splat);
        const { x, y, dx, dy, color, type } = splat;
        let splatRadius = originalSplatRadius;
        const aspect = canvasSize.width / canvasSize.height;
        if (aspect > 1) splatRadius *= aspect;
        if (type === 'velocity') {
          FluidKernels.splatStep(glCtx, splatProgram, velocity, x, y, dx, dy, { r: dx, g: dy, b: 0 }, splatRadius, blit);
        } else if (type === 'dye' && color) {
          FluidKernels.splatStep(glCtx, splatProgram, dye, x, y, 0, 0, { r: color[0], g: color[1], b: color[2] }, splatRadius, blit);
        }
      }

      err = glCtx.getError();
      if (err !== glCtx.NO_ERROR) {
        console.error('WebGL error after splatQueue processing:', err);
      }

      simulationStep(dt);

      err = glCtx.getError();
      if (err !== glCtx.NO_ERROR) {
        console.error('WebGL error after simulationStep:', err);
      }

      // Toggle debug render target here for visual inspection
      const debugRenderTarget = dye; // Change to velocity, divergence, pressure, curl to debug
      glCtx.bindFramebuffer(glCtx.FRAMEBUFFER, null);
      glCtx.viewport(0, 0, canvasSize.width, canvasSize.height);
      copyProgram.bind();
      glCtx.bindBuffer(glCtx.ARRAY_BUFFER, quadBuffer);
      glCtx.enableVertexAttribArray(aPosition);
      glCtx.vertexAttribPointer(aPosition, 2, glCtx.FLOAT, false, 0, 0);
      glCtx.activeTexture(glCtx.TEXTURE0);
      glCtx.bindTexture(glCtx.TEXTURE_2D, debugRenderTarget.read.texture);
      const uTexture = glCtx.getUniformLocation(copyProgram.program, 'uTexture');
      glCtx.uniform1i(uTexture, 0);
      glCtx.drawArrays(glCtx.TRIANGLES, 0, 6);

      if (running) requestAnimationFrame(renderLoop);
    }
    renderLoop();

    return () => {
      running = false;
    };
  }, [glCtx, programs, fbos, blit, aPosition, quadBuffer, canvasSize.width, canvasSize.height, splatQueue, originalSplatRadius]);
}
