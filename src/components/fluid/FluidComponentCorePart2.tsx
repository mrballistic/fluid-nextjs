import React, { useRef, useEffect } from 'react';
import { useFluidPointer } from './useFluidPointer';
import { useFluidWebGLSetup } from './useFluidWebGLSetup';
import { useFluidSimulationLoop } from './useFluidSimulationLoop';
import type { Splat } from './FluidComponentCorePart1';
import {
  ORIGINAL_SPLAT_FORCE,
  ORIGINAL_SPLAT_RADIUS
} from './FluidComponentCorePart1';

const FluidComponentCore: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerState = useRef({
    down: false,
    lastX: 0,
    lastY: 0,
    color: [1, 1, 1] as [number, number, number],
  });
  const splatQueue = useRef<Splat[]>([]);

  const [canvasSize, setCanvasSize] = React.useState<{ width: number; height: number }>({ width, height });

  useFluidPointer({
    canvasRef,
    pointerState,
    splatQueue,
    canvasSize,
    originalSplatForce: ORIGINAL_SPLAT_FORCE,
  });

  const {
    glCtx,
    programs,
    fbos,
    blit,
    aPosition,
    quadBuffer,
  } = useFluidWebGLSetup({ canvasRef, canvasSize });

  useFluidSimulationLoop({
    glCtx,
    programs,
    fbos,
    blit,
    aPosition,
    quadBuffer,
    canvasSize,
    splatQueue,
    originalSplatRadius: ORIGINAL_SPLAT_RADIUS,
  });

  useEffect(() => {
    function updateCanvasSize() {
      const dpr = window.devicePixelRatio || 1;
      const width = Math.round(canvasRef.current?.clientWidth || 512);
      const height = Math.round(canvasRef.current?.clientHeight || 512);
      setCanvasSize({ width: width * dpr, height: height * dpr });
    }
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [canvasRef, setCanvasSize]);

  return (
    <canvas
      ref={canvasRef}
      width={canvasSize.width}
      height={canvasSize.height}
      style={{ width: '100%', height: '100%', display: 'block', background: '#000' }}
    />
  );
};

export default FluidComponentCore;
