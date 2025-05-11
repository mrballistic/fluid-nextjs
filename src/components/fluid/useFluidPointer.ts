import { useFluidPointerHandler } from './FluidPointerHandler';
import type { Splat } from './FluidComponentCorePart1';
import type { RefObject } from 'react';

interface UseFluidPointerParams {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  pointerState: React.MutableRefObject<{
    down: boolean;
    lastX: number;
    lastY: number;
    color: [number, number, number];
  }>;
  splatQueue: React.MutableRefObject<Splat[]>;
  canvasSize: { width: number; height: number };
  originalSplatForce: number;
}

export function useFluidPointer({
  canvasRef,
  pointerState,
  splatQueue,
  canvasSize,
  originalSplatForce,
}: UseFluidPointerParams) {
  const getPointerPos = (e: MouseEvent | PointerEvent | TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    let clientX: number;
    let clientY: number;
    if ('clientX' in e && 'clientY' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = 0;
      clientY = 0;
    }
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = (1 - (clientY - rect.top) / rect.height) * canvas.height;
    return { x, y };
  };

  function originalRandomColor(): [number, number, number] {
    const h = Math.random();
    const s = 1.0;
    const v = 1.0;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    let r = 1, g = 1, b = 1;
    switch (i % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      case 5: r = v; g = p; b = q; break;
      default: r = 1; g = 1; b = 1;
    }
    return [r * 0.15, g * 0.15, b * 0.15];
  }

  useFluidPointerHandler({
    canvasRef,
    pointerState,
    splatQueue,
    canvasSize,
    originalRandomColor,
    getPointerPos,
    ORIGINAL_SPLAT_FORCE: originalSplatForce,
  });

  return {
    getPointerPos,
    originalRandomColor,
  };
}
