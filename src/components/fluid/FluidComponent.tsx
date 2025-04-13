"use client";
import React, {
  useEffect,
  useRef,
  useCallback,
  useMemo,
  memo,
  CSSProperties,
} from "react";
import FluidSimulation from './FluidSimulation.js';
import logger from './utils/logger.js';

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
  config?: Partial<FluidConfig>;
}

// --- Utility Functions ---
const scaleByPixelRatio = (input: number): number => {
  if (typeof window === 'undefined') return Math.floor(input);
  const pixelRatio = window.devicePixelRatio || 1;
  return Math.floor(input * pixelRatio);
};

const HSVtoRGB = (h: number, s: number, v: number): { r: number; g: number; b: number } => {
  let r: number = 0, g: number = 0, b: number = 0;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return { r, g, b };
};

const generateColor = (): { r: number; g: number; b: number } => {
  return HSVtoRGB(Math.random(), 1.0, 1.0);
};

// Default configuration - using values from the original working code
const defaultConfig = {
  SIM_RESOLUTION: 128,
  DYE_RESOLUTION: 1024,
  CAPTURE_RESOLUTION: 512,
  DENSITY_DISSIPATION: 3.5, // Using original value
  VELOCITY_DISSIPATION: 2.0, // Using original value
  PRESSURE: 0.1, // Using original value
  PRESSURE_ITERATIONS: 20,
  CURL: 3, // Using original value
  SPLAT_RADIUS: 0.2, // Using original value
  SPLAT_FORCE: 6000, // Using original value
  SHADING: true,
  COLORFUL: true,
  COLOR_UPDATE_SPEED: 10,
  PAUSED: false,
  BACK_COLOR: { r: 0.5, g: 0, b: 0 }, // Using original value
  TRANSPARENT: true, // Using original value
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fluidSimRef = useRef<FluidSimulation | null>(null);
  const animationFrameId = useRef<number | null>(null);
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
  
  const pointers = useRef<Pointer[]>([{ 
    id: -1, 
    x: -1, 
    y: -1, 
    dx: 0, 
    dy: 0, 
    down: false, 
    moved: false, 
    color: { r: 1.0, g: 0.5, b: 0.7 } 
  }]);

  // Merge default config with prop config
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
    logger.log("Fluid component mounted.");
    const canvas = canvasRef.current;
    if (!canvas) return;

    // --- Initialize WebGL Context ---
    const params = {
      alpha: false,
      depth: false,
      stencil: false,
      antialias: false,
      preserveDrawingBuffer: true, // Changed to true to prevent clearing between frames
    };
    
    const glContext = canvas.getContext("webgl2", params) || 
                      canvas.getContext("webgl", params) || 
                      canvas.getContext("experimental-webgl", params);

    if (!(glContext instanceof WebGLRenderingContext) && 
        !(glContext instanceof WebGL2RenderingContext)) {
      logger.error("Failed to get a valid WebGL context.");
      return;
    }

    const gl = glContext;

    // --- Create Fluid Simulation Instance ---
    try {
      logger.log("Creating FluidSimulation with WebGL context");
      logger.log("Canvas dimensions:", canvas.width, "x", canvas.height);
      fluidSimRef.current = new FluidSimulation(gl, config);
      logger.log("FluidSimulation created successfully");
      
      // Remove the test splat that was filling the screen
      // setTimeout(() => {
      //   if (fluidSimRef.current) {
      //     logger.log("Creating test splat");
      //     const testColor = { r: 1.0, g: 0.0, b: 0.0 }; // Bright red
      //     fluidSimRef.current.splat(0.5, 0.5, 0, 0, testColor);
      //     logger.log("Test splat created");
      //   }
      // }, 1000);
    } catch (error) {
      logger.error("Failed to initialize Fluid Simulation:", error);
      return;
    }

    // --- Resize Handling ---
    const handleResize = () => {
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
    const getPointer = (id: number): Pointer => {
      let pointer = pointers.current.find(p => p.id === id);
      if (!pointer) {
        const newPointer: Pointer = { 
          id, 
          x: 0, 
          y: 0, 
          dx: 0, 
          dy: 0, 
          down: false, 
          moved: false, 
          color: generateColor() 
        };
        pointers.current.push(newPointer);
        pointer = newPointer;
      }
      return pointer;
    };

    const normalizeCoord = (coord: number, dimension: number): number => coord / dimension;

    const handlePointerDown = (e: PointerEvent) => {
      if (!canvas) return;
      const canvasBounds = canvas.getBoundingClientRect();
      const x = normalizeCoord(e.clientX - canvasBounds.left, canvasBounds.width);
      const y = normalizeCoord(e.clientY - canvasBounds.top, canvasBounds.height);
      const pointer = getPointer(e.pointerId ?? 0);
      pointer.down = true;
      pointer.moved = true; // Set moved to true to trigger an immediate splat
      pointer.x = x;
      pointer.y = y;
      pointer.color = generateColor(); // Assign new color on press
      
      // Create an immediate splat on pointer down
      if (fluidSimRef.current) {
        fluidSimRef.current.splat(x, 1.0 - y, 0, 0, pointer.color); // Initial splat with no velocity
      }
      
      logger.log(`Pointer down at (${x.toFixed(3)}, ${y.toFixed(3)})`);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!canvas) return;
      const canvasBounds = canvas.getBoundingClientRect();
      const x = normalizeCoord(e.clientX - canvasBounds.left, canvasBounds.width);
      const y = normalizeCoord(e.clientY - canvasBounds.top, canvasBounds.height);
      const pointer = getPointer(e.pointerId ?? 0);
      if (!pointer.down) return; // Only track if down
      
      // Calculate velocity
      const dx = (x - pointer.x) * (config.SPLAT_FORCE ?? 6000);
      const dy = (y - pointer.y) * -(config.SPLAT_FORCE ?? 6000); // Invert Y
      
      // Create a splat directly on move for immediate feedback
      if (fluidSimRef.current && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        fluidSimRef.current.splat(x, 1.0 - y, dx, dy, pointer.color);
        logger.log(`Direct splat on move: (${x.toFixed(3)}, ${y.toFixed(3)}), velocity: (${dx.toFixed(0)}, ${dy.toFixed(0)})`);
      }
      
      // Update pointer for the splat loop
      pointer.x = x;
      pointer.y = y;
      pointer.dx = dx;
      pointer.dy = dy;
      pointer.moved = true;
    };

    const handlePointerUp = (e: PointerEvent) => {
      const pointer = getPointer(e.pointerId ?? 0);
      pointer.down = false;
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault(); // Prevent default touch behavior like scrolling
      if (!canvas) return;
      const touches = e.targetTouches;
      const canvasBounds = canvas.getBoundingClientRect();
      for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        const x = normalizeCoord(touch.clientX - canvasBounds.left, canvasBounds.width);
        const y = normalizeCoord(touch.clientY - canvasBounds.top, canvasBounds.height);
        const pointer = getPointer(touch.identifier);
        pointer.down = true;
        pointer.moved = true; // Set moved to true to trigger an immediate splat
        pointer.x = x;
        pointer.y = y;
        pointer.color = generateColor();
        
        // Create an immediate splat on touch start
        if (fluidSimRef.current) {
          fluidSimRef.current.splat(x, 1.0 - y, 0, 0, pointer.color); // Initial splat with no velocity
        }
        
        logger.log(`Touch start at (${x.toFixed(3)}, ${y.toFixed(3)})`);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (!canvas) return;
      const touches = e.targetTouches;
      const canvasBounds = canvas.getBoundingClientRect();
      for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        const x = normalizeCoord(touch.clientX - canvasBounds.left, canvasBounds.width);
        const y = normalizeCoord(touch.clientY - canvasBounds.top, canvasBounds.height);
        const pointer = getPointer(touch.identifier);
        if (!pointer.down) continue; // Should not happen but safety check
        
        // Calculate velocity
        const dx = (x - pointer.x) * (config.SPLAT_FORCE ?? 6000);
        const dy = (y - pointer.y) * -(config.SPLAT_FORCE ?? 6000); // Invert Y
        
        // Create a splat directly on move for immediate feedback
        if (fluidSimRef.current && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
          fluidSimRef.current.splat(x, 1.0 - y, dx, dy, pointer.color);
        }
        
        // Update pointer for the splat loop
        pointer.x = x;
        pointer.y = y;
        pointer.dx = dx;
        pointer.dy = dy;
        pointer.moved = true;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touches = e.changedTouches;
      for (let i = 0; i < touches.length; i++) {
        const pointer = getPointer(touches[i].identifier);
        pointer.down = false;
      }
    };

    // Add event listeners with console logs to debug
    canvas.addEventListener("pointerdown", (e) => {
      console.log("Pointer down event received");
      handlePointerDown(e as PointerEvent);
    });
    canvas.addEventListener("pointermove", (e) => {
      console.log("Pointer move event received");
      handlePointerMove(e as PointerEvent);
    });
    window.addEventListener("pointerup", (e) => {
      console.log("Pointer up event received");
      handlePointerUp(e as PointerEvent);
    });
    canvas.addEventListener("touchstart", (e) => {
      console.log("Touch start event received");
      handleTouchStart(e as TouchEvent);
    }, { passive: false });
    canvas.addEventListener("touchmove", (e) => {
      console.log("Touch move event received");
      handleTouchMove(e as TouchEvent);
    }, { passive: false });
    canvas.addEventListener("touchend", (e) => {
      console.log("Touch end event received");
      handleTouchEnd(e as TouchEvent);
    });

    // --- Start Animation Loop ---
    lastUpdateTime.current = Date.now();
    animationFrameId.current = requestAnimationFrame(update);

    // --- Splat Loop ---
    const splatInterval = setInterval(() => {
      if (fluidSimRef.current) {
        pointers.current.forEach(p => {
          if (p.moved) {
            fluidSimRef.current?.splat(p.x, 1.0 - p.y, p.dx, p.dy, p.color); // Invert Y for splat
            p.moved = false; // Reset moved flag after splatting
          }
        });
      }
    }, 16); // Approx 60 FPS for splats

    // --- Cleanup ---
    return () => {
      logger.log("Fluid component cleanup triggered by React.");
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      clearInterval(splatInterval);
      window.removeEventListener("resize", handleResize);
      
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
      
      // Clean up pointers array
      pointers.current = pointers.current.filter(p => p.id === -1); // Keep only the default placeholder
    };
  }, []); // Run only once on mount

  // Add a click handler directly on the div to ensure clicks are captured
  const handleDivClick = (e: React.MouseEvent) => {
    console.log("Div clicked at", e.clientX, e.clientY);
    
    // Always create a splat at the center for now, since mouse coordinates might not map correctly
    createCenterSplat();
    
    // Also try to create a splat at the clicked position
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const canvasBounds = canvas.getBoundingClientRect();
    const x = (e.clientX - canvasBounds.left) / canvasBounds.width;
    const y = (e.clientY - canvasBounds.top) / canvasBounds.height;
    
    if (fluidSimRef.current) {
      const color = { r: Math.random(), g: Math.random(), b: Math.random() };
      fluidSimRef.current.splat(x, 1.0 - y, 0, 0, color);
      console.log("Manual splat created at", x, y);
    }
  };

  // Function to create a splat in the middle of the screen
  const createCenterSplat = () => {
    if (!fluidSimRef.current) return;
    
    // Create a test splat with a bright red color
    const color = { r: 1.0, g: 0.0, b: 0.0 };
    
    // Create a large splat in the center
    fluidSimRef.current.splat(0.5, 0.5, 0, 0, color);
    
    // Create additional splats around the center
    fluidSimRef.current.splat(0.45, 0.45, 0, 0, { r: 0.0, g: 1.0, b: 0.0 });
    fluidSimRef.current.splat(0.55, 0.45, 0, 0, { r: 0.0, g: 0.0, b: 1.0 });
    fluidSimRef.current.splat(0.45, 0.55, 0, 0, { r: 1.0, g: 1.0, b: 0.0 });
    fluidSimRef.current.splat(0.55, 0.55, 0, 0, { r: 0.0, g: 1.0, b: 1.0 });
    
    // Create a random splat with random velocity
    const randomColor = { r: Math.random(), g: Math.random(), b: Math.random() };
    const dx = (Math.random() - 0.5) * 1000;
    const dy = (Math.random() - 0.5) * 1000;
    fluidSimRef.current.splat(0.5, 0.5, dx, dy, randomColor);
    
    console.log("Created multiple splats with different colors and positions");
  };

  // No automatic splats - only create splats on user interaction

  return (
    <div 
      style={{ position: 'relative', width: '100%', height: '100%' }}
      onClick={handleDivClick}
    >
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: 'block', ...style }} />
      
      <button
        onClick={(e) => {
          e.stopPropagation();
          createCenterSplat();
        }}
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          padding: '10px 20px',
          background: '#ff5500',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          zIndex: 1000,
          fontWeight: 'bold'
        }}
      >
        Create Center Splat
      </button>
    </div>
  );
});

Fluid.displayName = "Fluid"; // Add display name for debugging

export default Fluid;
