import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type { Splat } from './FluidComponentCorePart1';

interface PointerHandlerParams {
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  pointerState: MutableRefObject<{
    down: boolean;
    lastX: number;
    lastY: number;
    color: [number, number, number];
  }>;
  splatQueue: MutableRefObject<Splat[]>;
  canvasSize: { width: number; height: number };
  originalRandomColor: () => [number, number, number];
  getPointerPos: (e: MouseEvent | PointerEvent | TouchEvent) => { x: number; y: number };
  ORIGINAL_SPLAT_FORCE: number;
}

export function useFluidPointerHandler({
  canvasRef,
  pointerState,
  splatQueue,
  canvasSize,
  originalRandomColor,
  getPointerPos,
  ORIGINAL_SPLAT_FORCE,
}: PointerHandlerParams) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleNativePointerMove = (e: PointerEvent) => {
      console.debug('Pointer move event:', e);
      if (e.pointerType === 'mouse' || e.pointerType === 'pen' || e.pointerType === 'touch') {
        const pos = getPointerPos(e);
        const lastX = pointerState.current.lastX;
        const lastY = pointerState.current.lastY;
        const deltaX = pos.x - lastX;
        const deltaY = pos.y - lastY;
        pointerState.current.lastX = pos.x;
        pointerState.current.lastY = pos.y;
        if (deltaX !== 0 || deltaY !== 0) {
          const simWidth = Math.max(256, Math.floor(canvasSize.width / 2));
          const simHeight = Math.max(256, Math.floor(canvasSize.height / 2));
          const nx = pos.x / canvasSize.width;
          const ny = pos.y / canvasSize.height;
          const vdx = (deltaX / canvasSize.width) * simWidth * ORIGINAL_SPLAT_FORCE;
          const vdy = (deltaY / canvasSize.height) * simHeight * ORIGINAL_SPLAT_FORCE;
          splatQueue.current.push({ x: nx, y: ny, dx: vdx, dy: vdy, type: 'velocity' });
        }
        if (pointerState.current.down && (deltaX !== 0 || deltaY !== 0)) {
          const nx = pos.x / canvasSize.width;
          const ny = pos.y / canvasSize.height;
          splatQueue.current.push({ x: nx, y: ny, dx: 0, dy: 0, color: pointerState.current.color, type: 'dye' });
        }
      }
    };
    const handleNativePointerDown = (e: PointerEvent) => {
      console.debug('Pointer down event:', e);
      if (e.pointerType === 'mouse' || e.pointerType === 'pen' || e.pointerType === 'touch') {
        const pos = getPointerPos(e);
        pointerState.current.down = true;
        pointerState.current.lastX = pos.x;
        pointerState.current.lastY = pos.y;
        pointerState.current.color = originalRandomColor();
        const clickColor: [number, number, number] = [
          pointerState.current.color[0] * 10,
          pointerState.current.color[1] * 10,
          pointerState.current.color[2] * 10,
        ];
        const nx = pos.x / canvasSize.width;
        const ny = pos.y / canvasSize.height;
        splatQueue.current.push({ x: nx, y: ny, dx: 0, dy: 0, color: clickColor, type: 'dye' });
      }
    };
    const handleNativePointerUp = () => {
      console.debug('Pointer up event');
      pointerState.current.down = false;
    };
    canvas.addEventListener('pointermove', handleNativePointerMove);
    canvas.addEventListener('pointerdown', handleNativePointerDown);
    canvas.addEventListener('pointerup', handleNativePointerUp);
    canvas.addEventListener('pointerout', handleNativePointerUp);
    return () => {
      canvas.removeEventListener('pointermove', handleNativePointerMove);
      canvas.removeEventListener('pointerdown', handleNativePointerDown);
      canvas.removeEventListener('pointerup', handleNativePointerUp);
      canvas.removeEventListener('pointerout', handleNativePointerUp);
    };
  }, [canvasRef, pointerState, splatQueue, canvasSize, originalRandomColor, getPointerPos, ORIGINAL_SPLAT_FORCE]);
}
