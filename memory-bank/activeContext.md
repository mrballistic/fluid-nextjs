# Active Context: Fluid NextJS

## Current Work Focus
- Debugging an issue where fluid simulation splats aren't showing up on the screen.
- Investigating WebGL rendering and event handling in the fluid simulation.
- Optimizing performance and responsiveness of the simulation.

## Recent Changes
- Removed the test splat that was filling the screen with red.
- Added direct click handler to ensure clicks are captured.
- Improved event handling with debug logging.
- Adjusted splat radius, force, and dissipation settings for better visibility.
- Modified the radius calculation in utils.js for more balanced splats.

## Current Bug Investigation
- The WebGL context is initializing correctly.
- Shaders are compiling successfully.
- Event handlers are receiving pointer events (particularly pointer up).
- The dye texture is being rendered correctly.
- However, splats are not appearing on the screen when interacting with the canvas.

## Next Steps
- Debug why splats aren't showing up despite events being captured.
- Investigate the splat rendering pipeline in FluidSimulation.js.
- Check if there are issues with the display shader or blending settings.
- Verify that the splat color and radius settings are appropriate.
- Consider adding more debug logging to trace the splat rendering process.

## Active Decisions and Considerations
- Using WebGL for hardware-accelerated rendering.
- Implementing a grid-based approach for solving fluid dynamics.
- Using double-buffering for efficient updates.
- Separating the simulation logic from the rendering code.
- Using React hooks for managing the simulation lifecycle.
