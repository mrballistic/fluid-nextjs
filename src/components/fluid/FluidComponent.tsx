import React, { useRef, useEffect, useState } from 'react';
import type { Splat } from './FluidComponentCorePart1';
import { useFluidPointerHandler } from './FluidPointerHandler';

/**
 * Pointer state for the fluid simulation.
 */
interface PointerState {
  down: boolean;
  lastX: number;
  lastY: number;
  color: [number, number, number];
}

/**
 * FluidComponent renders the interactive fluid simulation canvas and manages pointer state.
 * Handles pointer events and canvas resizing.
 * @component
 */
const FluidComponent: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({ width: 512, height: 512 });
  const pointerState = useRef<PointerState>({
    down: false,
    lastX: 0,
    lastY: 0,
    color: [1, 1, 1],
  });
  const splatQueue = useRef<Splat[]>([]);

  /**
   * Returns the pointer position relative to the canvas, normalized to canvas coordinates.
   * @param {MouseEvent | PointerEvent | TouchEvent} e - The pointer event
   * @returns {{ x: number, y: number }} The pointer position
   */
  const getPointerPos = (e: MouseEvent | PointerEvent | TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    let clientX = 0, clientY = 0;
    if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = (1 - (clientY - rect.top) / rect.height) * canvas.height;
    return { x, y };
  };

  /**
   * Generates a random color in HSV space, converted to RGB, for splats.
   * @returns {[number, number, number]} The RGB color array
   */
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
    ORIGINAL_SPLAT_FORCE: 6000,
  });

  useEffect(() => {
    /**
     * Updates the canvas size to match the device pixel ratio and window size.
     */
    function updateCanvasSize() {
      const dpr = window.devicePixelRatio || 1;
      const width = Math.round(canvasRef.current?.clientWidth || 512);
      const height = Math.round(canvasRef.current?.clientHeight || 512);
      setCanvasSize({ width: width * dpr, height: height * dpr });
    }
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={canvasSize.width}
      height={canvasSize.height}
      style={{ width: '100%', height: '100%', display: 'block', background: '#000' }}
    />
  );
};

export default FluidComponent;
