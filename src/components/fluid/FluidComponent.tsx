"use client";
import React, {
  // useState, // Removed unused import
  useEffect,
  useRef,
  useCallback,
  useMemo, // Added useMemo
  memo, // Added memo
  CSSProperties, // Import CSSProperties for style prop typing
  // useMemo, // Removed duplicate import
} from "react";
import FluidSimulation from './FluidSimulation.js'; // Keep .js extension for now, or update FluidSimulation to .ts

// Define interfaces for configuration and props
interface FluidConfig {
  SIM_RESOLUTION?: number;
  DYE_RESOLUTION?: number;
  CAPTURE_RESOLUTION?: number;
  DENSITY_DISSIPATION?: number;
  VELOCITY_DISSIPATION?: number;
  PRESSURE?: number;
  PRESSURE_ITERATIONS?: number;
  CURL?: number;
  SPLAT_RADIUS?: number;
  SPLAT_FORCE?: number;
  SHADING?: boolean;
  COLORFUL?: boolean;
  COLOR_UPDATE_SPEED?: number;
  PAUSED?: boolean;
  BACK_COLOR?: { r: number; g: number; b: number };
  TRANSPARENT?: boolean;
  BLOOM?: boolean;
  BLOOM_ITERATIONS?: number;
  BLOOM_RESOLUTION?: number;
  BLOOM_INTENSITY?: number;
  BLOOM_THRESHOLD?: number;
  BLOOM_SOFT_KNEE?: number;
  SUNRAYS?: boolean;
  SUNRAYS_RESOLUTION?: number;
  SUNRAYS_WEIGHT?: number;
}

interface FluidProps {
  style?: CSSProperties;
  config?: Partial<FluidConfig>; // Use Partial as config is optional and can override defaults
}


// --- Utility Functions (Keep only those needed by the React component) ---
const scaleByPixelRatio = (input: number): number => { // Add types
  // Check if window is defined (for server-side rendering or testing environments)
  if (typeof window === 'undefined') return Math.floor(input);
  const pixelRatio = window.devicePixelRatio || 1;
  return Math.floor(input * pixelRatio);
};

// HSVtoRGB might be needed if generateColor is used directly in the component
const HSVtoRGB = (h: number, s: number, v: number): { r: number; g: number; b: number } => { // Add types
  let r: number = 0, g: number = 0, b: number = 0; // Initialize variables
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
    default:
      break;
  }
  return { r, g, b };
};

// generateColor might be needed for splats
const generateColor = (): { r: number; g: number; b: number } => { // Add return type
  const c = HSVtoRGB(Math.random(), 1.0, 1.0); // Use const
  c.r *= 0.15; // Dim the color
  c.g *= 0.15;
  c.b *= 0.15;
  return c;
};

// Removed unused 'wrap' function
// const wrap = (value, min, max) => {
//   const range = max - min;
//   if (range === 0) return min;
//   return ((value - min) % range) + min;
// };

// Removed unused 'hashCode' function
// const hashCode = (s: string): number => { // Add types if uncommented
//   if (s.length === 0) return 0;
//   let hash = 0;
//   for (let i = 0; i < s.length; i++) {
//     hash = (hash << 5) - hash + s.charCodeAt(i);
//     hash |= 0; // Convert to 32bit integer
//   }
//   return hash;
// };
// Removed leftover code from commented hashCode function

// --- REMOVE WebGL Utils, Shaders, Program, Material, FluidSimulation ---
// --- The Fluid React Component ---

// Default configuration (can be overridden by props)
const defaultConfig = {
  SIM_RESOLUTION: 128,
  DYE_RESOLUTION: 1024,
  CAPTURE_RESOLUTION: 512,
  DENSITY_DISSIPATION: 1,
  VELOCITY_DISSIPATION: 0.2,
  PRESSURE: 0.8,
  PRESSURE_ITERATIONS: 20,
  CURL: 30,
  SPLAT_RADIUS: 0.25,
  SPLAT_FORCE: 6000,
  SHADING: true,
  COLORFUL: true,
  COLOR_UPDATE_SPEED: 10,
  PAUSED: false,
  BACK_COLOR: { r: 0, g: 0, b: 0 },
  TRANSPARENT: false,
  BLOOM: true,
  BLOOM_ITERATIONS: 8,
  BLOOM_RESOLUTION: 256,
  BLOOM_INTENSITY: 0.8,
  BLOOM_THRESHOLD: 0.6,
  BLOOM_SOFT_KNEE: 0.7,
  SUNRAYS: true,
  SUNRAYS_RESOLUTION: 196,
  SUNRAYS_WEIGHT: 1.0,
};


const Fluid: React.FC<FluidProps> = memo(({ style, config: propConfig = {} }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null); // Type the ref
  const fluidSimRef = useRef<FluidSimulation | null>(null); // Type the ref
  const animationFrameId = useRef<number | null>(null); // Type the ref
  const lastUpdateTime = useRef(Date.now());
  // Define pointer type
  interface Pointer {
    id: number;
    x: number;
    y: number;
    dx: number;
    dy: number;
    down: boolean;
    moved: boolean;
    color: { r: number; g: number; b: number };
  }
  const pointers = useRef<Pointer[]>([{ id: -1, x: -1, y: -1, dx: 0, dy: 0, down: false, moved: false, color: { r: 30, g: 0, b: 300 } }]); // Type the ref

  // Merge default config with prop config, ensure type safety
  const config: FluidConfig = useMemo(() => ({ ...defaultConfig, ...propConfig }), [propConfig]);


  // --- Simulation Update ---
  const update = useCallback(() => {
    const now = Date.now();
    let dt = (now - lastUpdateTime.current) / 1000;
    dt = Math.min(dt, 0.016666); // Clamp timestep
    lastUpdateTime.current = now;

    if (!config.PAUSED && fluidSimRef.current) {
      fluidSimRef.current.step(dt);
      fluidSimRef.current.render(null); // Render to canvas
    }
    animationFrameId.current = requestAnimationFrame(update);
  }, [config.PAUSED]);


  // --- Initialization and Cleanup ---
  useEffect(() => {
  console.log("Fluid component mounted.");
    const canvas = canvasRef.current;
    if (!canvas) return;

    // --- Initialize WebGL Context ---
    // Use a helper or directly get context here
    const params = {
      alpha: true,
      depth: false,
      stencil: false,
      antialias: false,
      preserveDrawingBuffer: false,
    };
    // Ensure gl context type is correct
    const glContext = canvas.getContext("webgl2", params) || canvas.getContext("webgl", params) || canvas.getContext("experimental-webgl", params);

    // Explicitly check if the context is a valid WebGL context
    if (!(glContext instanceof WebGLRenderingContext) && !(glContext instanceof WebGL2RenderingContext)) {
      console.error("Failed to get a valid WebGL context.");
      return;
    }

    const gl = glContext; // Assign to gl after successful type check

    // --- Create Fluid Simulation Instance ---
    try {
        // gl is now guaranteed to be WebGLRenderingContext or WebGL2RenderingContext
        fluidSimRef.current = new FluidSimulation(gl, config);
    } catch (error) {
        console.error("Failed to initialize Fluid Simulation:", error);
        // Handle initialization error (e.g., show error message)
        return; // Stop execution if simulation fails to initialize
    }


    // --- Resize Handling ---
    const handleResize = () => {
      // Ensure canvas exists before accessing properties
      if (!canvas) return;
      const width = scaleByPixelRatio(canvas.clientWidth);
      const height = scaleByPixelRatio(canvas.clientHeight);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        if (fluidSimRef.current) {
          fluidSimRef.current.resize();
        }
      }
    };
    handleResize(); // Initial resize
    window.addEventListener("resize", handleResize);

    // --- Pointer Event Handling ---
    const getPointer = (id: number): Pointer => { // Add type annotation
        let pointer = pointers.current.find(p => p.id === id);
        if (!pointer) {
            // Ensure the object matches the Pointer interface
            const newPointer: Pointer = { id, x: 0, y: 0, dx: 0, dy: 0, down: false, moved: false, color: generateColor() }; // Use const for newPointer
            pointers.current.push(newPointer);
            pointer = newPointer; // Assign newPointer to pointer
        }
        return pointer;
    };

    const updatePointer = (pointer: Pointer, canvasBounds: DOMRect, x: number, y: number) => { // Add type annotations
        pointer.moved = pointer.down;
        // Ensure SPLAT_FORCE is defined or provide a default
        const splatForce = config.SPLAT_FORCE ?? 6000;
        pointer.dx = (x - pointer.x) * splatForce;
        pointer.dy = (y - pointer.y) * -splatForce; // Invert Y
        pointer.x = x;
        pointer.y = y;
    };

     const normalizeCoord = (coord: number, dimension: number): number => coord / dimension; // Add type annotations


    const handlePointerDown = (e: PointerEvent) => { // Type the event
      if (!canvas) return;
      const canvasBounds = canvas.getBoundingClientRect();
      const x = normalizeCoord(e.clientX - canvasBounds.left, canvasBounds.width);
      const y = normalizeCoord(e.clientY - canvasBounds.top, canvasBounds.height);
      const pointer = getPointer(e.pointerId ?? 0); // Use const
      pointer.down = true;
      pointer.moved = false; // Reset moved flag on down
      pointer.x = x;
      pointer.y = y;
      pointer.color = generateColor(); // Assign new color on press
    };

    const handlePointerMove = (e: PointerEvent) => { // Type the event
      if (!canvas) return;
      const canvasBounds = canvas.getBoundingClientRect();
      const x = normalizeCoord(e.clientX - canvasBounds.left, canvasBounds.width);
      const y = normalizeCoord(e.clientY - canvasBounds.top, canvasBounds.height);
      const pointer = getPointer(e.pointerId ?? 0); // Use const
      if (!pointer.down) return; // Only track if down
      updatePointer(pointer, canvasBounds, x, y);
    };

    const handlePointerUp = (e: PointerEvent) => { // Type the event
      const pointer = getPointer(e.pointerId ?? 0); // Use const
      pointer.down = false;
    };

     const handleTouchStart = (e: TouchEvent) => { // Type the event
        e.preventDefault(); // Prevent default touch behavior like scrolling
        if (!canvas) return;
        const touches = e.targetTouches;
        const canvasBounds = canvas.getBoundingClientRect();
        for (let i = 0; i < touches.length; i++) {
            const touch = touches[i];
            const x = normalizeCoord(touch.clientX - canvasBounds.left, canvasBounds.width);
            const y = normalizeCoord(touch.clientY - canvasBounds.top, canvasBounds.height);
            const pointer = getPointer(touch.identifier); // Use const
            pointer.down = true;
            pointer.moved = false;
            pointer.x = x;
            pointer.y = y;
            pointer.color = generateColor();
        }
    };

    const handleTouchMove = (e: TouchEvent) => { // Type the event
        e.preventDefault();
        if (!canvas) return;
        const touches = e.targetTouches;
        const canvasBounds = canvas.getBoundingClientRect();
        for (let i = 0; i < touches.length; i++) {
            const touch = touches[i];
            const x = normalizeCoord(touch.clientX - canvasBounds.left, canvasBounds.width);
            const y = normalizeCoord(touch.clientY - canvasBounds.top, canvasBounds.height);
            const pointer = getPointer(touch.identifier); // Use const
            if (!pointer.down) continue; // Should not happen but safety check
            updatePointer(pointer, canvasBounds, x, y);
        }
    };

    const handleTouchEnd = (e: TouchEvent) => { // Type the event
        const touches = e.changedTouches;
        for (let i = 0; i < touches.length; i++) {
            const pointer = getPointer(touches[i].identifier); // Use const
            pointer.down = false;
        }
    };


    // Add type safety for event listeners
    canvas.addEventListener("pointerdown", handlePointerDown as EventListener);
    canvas.addEventListener("pointermove", handlePointerMove as EventListener);
    window.addEventListener("pointerup", handlePointerUp as EventListener); // Listen on window for up event
    canvas.addEventListener("touchstart", handleTouchStart as EventListener, { passive: false });
    canvas.addEventListener("touchmove", handleTouchMove as EventListener, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd as EventListener);


    // --- Start Animation Loop ---
    lastUpdateTime.current = Date.now();
    animationFrameId.current = requestAnimationFrame(update);

    // --- Splat Loop ---
    const splatInterval = setInterval(() => {
      if (fluidSimRef.current) {
        pointers.current.forEach(p => {
          if (p.moved) {
            // Ensure splat method exists and call it
            fluidSimRef.current?.splat(p.x, 1.0 - p.y, p.dx, p.dy, p.color); // Invert Y for splat
            p.moved = false; // Reset moved flag after splatting
          }
        });
      }
    }, 16); // Approx 60 FPS for splats


    // --- Cleanup ---
    return () => {
  console.log("Fluid component cleanup triggered by React.");
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      clearInterval(splatInterval);
      window.removeEventListener("resize", handleResize);
      // Ensure canvas exists before removing listeners
      if (canvas) {
        canvas.removeEventListener("pointerdown", handlePointerDown as EventListener);
        canvas.removeEventListener("pointermove", handlePointerMove as EventListener);
        canvas.removeEventListener("touchstart", handleTouchStart as EventListener);
        canvas.removeEventListener("touchmove", handleTouchMove as EventListener);
        canvas.removeEventListener("touchend", handleTouchEnd as EventListener);
      }
      window.removeEventListener("pointerup", handlePointerUp as EventListener);
      if (fluidSimRef.current) {
        fluidSimRef.current.dispose();
        fluidSimRef.current = null;
      }
      // Clean up pointers array? Maybe remove inactive pointers
      pointers.current = pointers.current.filter(p => p.id === -1); // Keep only the default placeholder
    };
  }, [config]); // Removed 'update' from dependencies to prevent unnecessary re-initializations

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: 'block', ...style }} />;
});

Fluid.displayName = "Fluid"; // Add display name for debugging

export default Fluid;
