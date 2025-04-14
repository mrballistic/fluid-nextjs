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

  // Default configuration - optimized for better curl and vorticity visualization
const defaultConfig = {
  SIM_RESOLUTION: 256, // Higher resolution for more detailed simulation
  DYE_RESOLUTION: 1024, // Closer to SIM_RESOLUTION for better visual quality
  CAPTURE_RESOLUTION: 512,
  DENSITY_DISSIPATION: 0.92, // Much faster dissipation to prevent dye buildup
  VELOCITY_DISSIPATION: 0.94, // Faster dissipation for velocity
  PRESSURE: 0.1,
  PRESSURE_ITERATIONS: 20,
  CURL: 50, // Higher curl value for more pronounced vorticity effects
  SPLAT_RADIUS: 0.005, // Slightly smaller splats
  SPLAT_FORCE: 800, // Reduced force for more controlled velocity
  SHADING: true,
  COLORFUL: true,
  COLOR_UPDATE_SPEED: 10,
  PAUSED: false,
  BACK_COLOR: { r: 0.0, g: 0.0, b: 0.0 }, // Black background
  TRANSPARENT: false, // Disable transparency to see background
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
  // Global variable to store mouse position
  const mousePosition = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  
  // Color update timer
  const colorUpdateTimer = useRef(0);
  
  // Generate a random color
  const generateColor = useCallback(() => {
    const HSVtoRGB = (h: number, s: number, v: number) => {
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
    
    // Generate a random color with HSV
    const c = HSVtoRGB(Math.random(), 1.0, 1.0);
    // Scale down the brightness
    c.r *= 0.15;
    c.g *= 0.15;
    c.b *= 0.15;
    return c;
  }, []);
  
  // Update colors periodically
  const updateColors = useCallback((dt: number) => {
    colorUpdateTimer.current += dt * config.COLOR_UPDATE_SPEED;
    if (colorUpdateTimer.current >= 1) {
      colorUpdateTimer.current = colorUpdateTimer.current % 1;
      // Update pointer colors
      pointers.current.forEach(p => {
        p.color = generateColor();
      });
    }
  }, [config.COLOR_UPDATE_SPEED, generateColor]);

  const update = useCallback(() => {
    const now = Date.now();
    let dt = (now - lastUpdateTime.current) / 1000;
    dt = Math.min(dt, 0.016666); // Clamp timestep
    lastUpdateTime.current = now;

    if (!config.PAUSED && fluidSimRef.current) {
      // Update colors periodically
      updateColors(dt);
      
      fluidSimRef.current.step(dt);
      fluidSimRef.current.render(null); // Render to canvas
      
      // Update the global mouse position on every frame
      if (typeof window !== 'undefined') {
        (window as any).fluidMouseX = mousePosition.current.x;
        (window as any).fluidMouseY = mousePosition.current.y;
      }
    }
    animationFrameId.current = requestAnimationFrame(update);
  }, [config.PAUSED, updateColors]);

  // Mouse velocity tracking
  const lastMousePositions = useRef<{time: number, x: number, y: number}[]>([]);
  const maxPositionHistory = 5; // Keep track of last 5 positions for smoother velocity calculation

  // --- Initialization and Cleanup ---

  useEffect(() => {
    logger.log("Fluid component mounted.");
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create a global variable to store mouse position
    if (typeof window !== 'undefined') {
      // Define the properties on the window object if they don't exist
      if (!window.hasOwnProperty('fluidMouseX')) {
        Object.defineProperty(window, 'fluidMouseX', {
          value: window.innerWidth / 2,
          writable: true,
          configurable: true
        });
      }
      
      if (!window.hasOwnProperty('fluidMouseY')) {
        Object.defineProperty(window, 'fluidMouseY', {
          value: window.innerHeight / 2,
          writable: true,
          configurable: true
        });
      }
      
      // Log initial mouse position
      console.log(`Initial mouse position set to: (${window.fluidMouseX}, ${window.fluidMouseY})`);
    }

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
      const invertedY = 1.0 - y; // Invert Y for WebGL coordinates
      const pointer = getPointer(e.pointerId ?? 0);
      pointer.down = true;
      pointer.moved = true; // Set moved to true to trigger an immediate splat
      pointer.x = x;
      pointer.y = y; // Store original DOM Y coordinate
      pointer.color = generateColor(); // Assign new color on press
      
      // Create an immediate splat on pointer down
      if (fluidSimRef.current) {
        fluidSimRef.current.splat(x, invertedY, 0, 0, pointer.color); // Use inverted Y for WebGL
      }
      
      logger.log(`Pointer down at (${x.toFixed(3)}, ${y.toFixed(3)}), WebGL Y: ${invertedY.toFixed(3)}`);
    };

    // Removed standalone handlePointerMove function

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
        const dy = (y - pointer.y) * (config.SPLAT_FORCE ?? 6000); // Don't invert Y
        
        // Create a splat directly on move for immediate feedback
        if (fluidSimRef.current && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
          // Use dy directly as it's calculated from non-inverted coordinates
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

    // Add event listeners with detailed coordinate logging and store mouse position
    canvas.addEventListener("pointerdown", (e) => {
      // Get canvas bounds and calculate normalized coordinates
      const canvasBounds = canvas.getBoundingClientRect();
      const clientX = e.clientX;
      const clientY = e.clientY;
      const canvasX = clientX - canvasBounds.left;
      const canvasY = clientY - canvasBounds.top;
      const normalizedX = canvasX / canvasBounds.width;
      const normalizedY = canvasY / canvasBounds.height;
      const invertedY = 1.0 - normalizedY; // WebGL uses bottom-left origin
      
      // Update global mouse position
      if (typeof window !== 'undefined') {
        (window as any).fluidMouseX = canvasX;
        (window as any).fluidMouseY = canvasY;
      }
      
      // Call the regular handler
      handlePointerDown(e as PointerEvent);
      
      // Create multiple splats directly at the pointer position
      if (fluidSimRef.current) {
        // Create a main splat
        const mainColor = { r: 1.0, g: 0.0, b: 0.0 }; // Bright red
        fluidSimRef.current.splat(normalizedX, invertedY, 0, 0, mainColor);
        
        // Create additional splats nearby with different colors
     //   fluidSimRef.current.splat(normalizedX - 0.01, invertedY - 0.01, 0, 0, { r: 0.0, g: 1.0, b: 0.0 });
       // fluidSimRef.current.splat(normalizedX + 0.01, invertedY - 0.01, 0, 0, { r: 0.0, g: 0.0, b: 1.0 });
        //fluidSimRef.current.splat(normalizedX - 0.01, invertedY + 0.01, 0, 0, { r: 1.0, g: 1.0, b: 0.0 });
        //fluidSimRef.current.splat(normalizedX + 0.01, invertedY + 0.01, 0, 0, { r: 0.0, g: 1.0, b: 1.0 });
      }
    });
    
    // Handle mouse movement - create fluid effects even when not clicking
    canvas.addEventListener("pointermove", (e) => {
      // Get canvas bounds and calculate normalized coordinates
      const canvasBounds = canvas.getBoundingClientRect();
      const canvasX = e.clientX - canvasBounds.left;
      const canvasY = e.clientY - canvasBounds.top;
      const normalizedX = canvasX / canvasBounds.width;
      const normalizedY = canvasY / canvasBounds.height;
      const invertedY = 1.0 - normalizedY; // WebGL uses bottom-left origin
      
      // Update global mouse position
      if (typeof window !== 'undefined') {
        (window as any).fluidMouseX = canvasX;
        (window as any).fluidMouseY = canvasY;
      }
      
      // Get the pointer
      const pointer = getPointer(0);
      
      // Add current position to history with timestamp
      const now = Date.now();
      lastMousePositions.current.push({time: now, x: normalizedX, y: invertedY});
      
      // Keep history limited to maxPositionHistory entries
      if (lastMousePositions.current.length > maxPositionHistory) {
        lastMousePositions.current.shift();
      }
      
      // Calculate velocity based on position history for smoother velocity
      let dx = 0;
      let dy = 0;
      
      if (lastMousePositions.current.length >= 2) {
        // Get oldest and newest positions
        const oldest = lastMousePositions.current[0];
        const newest = lastMousePositions.current[lastMousePositions.current.length - 1];
        
        // Calculate time difference in seconds
        const dt = (newest.time - oldest.time) / 1000;
        
        if (dt > 0) {
          // Calculate velocity in normalized coordinates per second
          dx = (newest.x - oldest.x) / dt;
          dy = (newest.y - oldest.y) / dt;
          
          // Scale velocity by splat force
          dx *= (config.SPLAT_FORCE ?? 6000) * 0.01;
          // DO NOT invert Y velocity here - we'll do it in the splat call
          dy *= (config.SPLAT_FORCE ?? 6000) * 0.01;
          
          // Log velocity for debugging
          if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            console.log(`Mouse velocity: (${dx.toFixed(2)}, ${dy.toFixed(2)})`);
          }
        }
      }
      
      // Update current position
      pointer.x = normalizedX;
      pointer.y = invertedY;
      
      // Update pointer for the splat loop
      pointer.dx = dx;
      pointer.dy = dy;
      
      // Mark as moved if there's enough movement
      pointer.moved = Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1;
      
      // Create a splat on mouse move with velocity
      if (fluidSimRef.current && pointer.moved && pointer.down) {
        // Use dy directly as it's calculated from inverted coordinates
        fluidSimRef.current.splat(normalizedX, invertedY, dx, dy, pointer.color);
        console.log(`Created velocity splat: pos(${normalizedX.toFixed(2)}, ${invertedY.toFixed(2)}), vel(${dx.toFixed(2)}, ${dy.toFixed(2)})`);
      }
      
      // Removed call to handlePointerMove
    });
    window.addEventListener("pointerup", (e) => {
      //console.log("Pointer up event received");
      handlePointerUp(e as PointerEvent);
    });
    canvas.addEventListener("touchstart", (e) => {
      //console.log("Touch start event received");
      handleTouchStart(e as TouchEvent);
    }, { passive: false });
    canvas.addEventListener("touchmove", (e) => {
      //console.log("Touch move event received");
      handleTouchMove(e as TouchEvent);
    }, { passive: false });
    canvas.addEventListener("touchend", (e) => {
      //console.log("Touch end event received");
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
            // Use p.dy directly as it's stored from inverted coordinates
            fluidSimRef.current?.splat(p.x, 1.0 - p.y, p.dx, p.dy, p.color);
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
    
    // Also try to create a splat at the clicked position
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const canvasBounds = canvas.getBoundingClientRect();
    const canvasX = e.clientX - canvasBounds.left;
    const canvasY = e.clientY - canvasBounds.top;
    const x = canvasX / canvasBounds.width;
    const y = canvasY / canvasBounds.height;
    
    // Update the last clicked position
    lastClickPosition.current = { x, y: 1.0 - y }; // Store inverted Y for WebGL
    
    // Update the canvas mouse position for automatic splats
    (canvas as any).mouseX = canvasX;
    (canvas as any).mouseY = canvasY;
    
    console.log(`Updated last click position: normalized(${x.toFixed(3)}, ${y.toFixed(3)}), WebGL(${x.toFixed(3)}, ${(1.0-y).toFixed(3)})`);
    console.log(`Updated canvas mouse position: canvas(${canvasX.toFixed(0)}, ${canvasY.toFixed(0)})`);
    
    // Create multiple splats with opposing velocities to generate curl
    if (fluidSimRef.current) {
      // Create a central splat
      const centerColor = { r: 1.0, g: 1.0, b: 1.0 };
      fluidSimRef.current.splat(x, 1.0 - y, 0, 0, centerColor);
      
      // Create a vortex pattern with 8 splats around the center
      const radius = 0.03;
      const force = 5000;
      
      // Top splat - downward velocity
      fluidSimRef.current.splat(x, 1.0 - y + radius, 0, -force, { r: 1.0, g: 0.0, b: 0.0 });
      
      // Top-right splat - down-left velocity
      fluidSimRef.current.splat(x + radius * 0.7, 1.0 - y + radius * 0.7, -force, -force, { r: 1.0, g: 0.5, b: 0.0 });
      
      // Right splat - leftward velocity
      fluidSimRef.current.splat(x + radius, 1.0 - y, -force, 0, { r: 0.0, g: 1.0, b: 0.0 });
      
      // Bottom-right splat - up-left velocity
      fluidSimRef.current.splat(x + radius * 0.7, 1.0 - y - radius * 0.7, -force, force, { r: 0.0, g: 1.0, b: 0.5 });
      
      // Bottom splat - upward velocity
      fluidSimRef.current.splat(x, 1.0 - y - radius, 0, force, { r: 0.0, g: 0.0, b: 1.0 });
      
      // Bottom-left splat - up-right velocity
      fluidSimRef.current.splat(x - radius * 0.7, 1.0 - y - radius * 0.7, force, force, { r: 0.5, g: 0.0, b: 1.0 });
      
      // Left splat - rightward velocity
      fluidSimRef.current.splat(x - radius, 1.0 - y, force, 0, { r: 1.0, g: 0.0, b: 1.0 });
      
      // Top-left splat - down-right velocity
      fluidSimRef.current.splat(x - radius * 0.7, 1.0 - y + radius * 0.7, force, -force, { r: 1.0, g: 0.0, b: 0.5 });
      
      console.log("Created vortex pattern at", x, y);
    }
  };

  // Track the last clicked position
  const lastClickPosition = useRef({ x: 0.5, y: 0.5 });

  // Function to create a splat at the last clicked position
  const createCenterSplat = () => {
    if (!fluidSimRef.current) return;
    
    // Get the last clicked position
    const x = lastClickPosition.current.x;
    const y = lastClickPosition.current.y;
    
    console.log(`Creating splats at last clicked position: (${x.toFixed(3)}, ${y.toFixed(3)})`);
    
    // Create a test splat with a bright red color
    const color = { r: 1.0, g: 0.0, b: 0.0 };
    
    // Create a large splat at the last clicked position
    fluidSimRef.current.splat(x, y, 0, 0, color);
    
    // Create additional splats around the last clicked position
    fluidSimRef.current.splat(x - 0.05, y - 0.05, 0, 0, { r: 0.0, g: 1.0, b: 0.0 });
    fluidSimRef.current.splat(x + 0.05, y - 0.05, 0, 0, { r: 0.0, g: 0.0, b: 1.0 });
    fluidSimRef.current.splat(x - 0.05, y + 0.05, 0, 0, { r: 1.0, g: 1.0, b: 0.0 });
    fluidSimRef.current.splat(x + 0.05, y + 0.05, 0, 0, { r: 0.0, g: 1.0, b: 1.0 });
    
    // Create a random splat with random velocity
    const randomColor = { r: Math.random(), g: Math.random(), b: Math.random() };
    const dx = (Math.random() - 0.5) * 1000;
    const dy = (Math.random() - 0.5) * 1000;
    fluidSimRef.current.splat(x, y, dx, dy, randomColor);
    
    //console.log(`Created multiple splats at (${x.toFixed(3)}, ${y.toFixed(3)})`);
  };

  // No automatic splats - removed as requested

  return (
    <div 
      style={{ position: 'relative', width: '100%', height: '100%' }}
      onClick={handleDivClick}
      onMouseMove={(e) => {
        // Update the global mouse position on every mouse move
        if (typeof window !== 'undefined') {
          const canvas = canvasRef.current;
          if (!canvas) return;
          
          const canvasBounds = canvas.getBoundingClientRect();
          const canvasX = e.clientX - canvasBounds.left;
          const canvasY = e.clientY - canvasBounds.top;
          
          // Update the mouse position ref
          mousePosition.current = { x: canvasX, y: canvasY };
          
          // Update global variables
          (window as any).fluidMouseX = canvasX;
          (window as any).fluidMouseY = canvasY;
          
         // console.log(`Mouse moved to: (${canvasX.toFixed(0)}, ${canvasY.toFixed(0)})`);
        }
      }}
    >
      <canvas 
        ref={canvasRef} 
        style={{ width: "100%", height: "100%", display: 'block', ...style }}
        onClick={(e) => {
         // console.log("CANVAS CLICK EVENT FIRED");
          e.stopPropagation(); // Prevent event from bubbling up
          
          const canvas = canvasRef.current;
          if (!canvas) return;
          
          const canvasBounds = canvas.getBoundingClientRect();
          const canvasX = e.clientX - canvasBounds.left;
          const canvasY = e.clientY - canvasBounds.top;
          const normalizedX = canvasX / canvasBounds.width;
          const normalizedY = canvasY / canvasBounds.height;
          
          // Create a splat directly at the clicked position
          if (fluidSimRef.current) {
            fluidSimRef.current.splat(
              normalizedX, 
              1.0 - normalizedY, // Invert Y for WebGL
              0, 0, 
              { r: 1.0, g: 0.0, b: 0.0 }
            );
            console.log(`Direct splat on canvas click: (${normalizedX.toFixed(3)}, ${(1.0-normalizedY).toFixed(3)})`);
          }
        }}
        onMouseDown={(e) => {
          //console.log("CANVAS MOUSE DOWN EVENT FIRED");
          
          const canvas = canvasRef.current;
          if (!canvas) return;
          
          const canvasBounds = canvas.getBoundingClientRect();
          const canvasX = e.clientX - canvasBounds.left;
          const canvasY = e.clientY - canvasBounds.top;
          const normalizedX = canvasX / canvasBounds.width;
          const normalizedY = canvasY / canvasBounds.height;
          
          // Create a splat directly at the clicked position
          if (fluidSimRef.current) {
            fluidSimRef.current.splat(
              normalizedX, 
              1.0 - normalizedY, // Invert Y for WebGL
              0, 0, 
              { r: 0.0, g: 1.0, b: 0.0 }
            );
            //console.log(`Direct splat on canvas mousedown: (${normalizedX.toFixed(3)}, ${(1.0-normalizedY).toFixed(3)})`);
          }
        }}
      />
      
      {/* Removed "Create Center Splat" button */}
    </div>
  );
});

Fluid.displayName = "Fluid"; // Add display name for debugging

export default Fluid;
