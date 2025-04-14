# Active Context: Fluid NextJS

## Current Work Focus
- Debugging and fixing issues with the fluid simulation's mouse interaction.
- Ensuring splats appear at the correct mouse position when clicked.
- Optimizing event handling for better user experience.
- Resolving turbopack compatibility issues with Next.js 15.3.0.

## Recent Changes
- Added direct event handlers to the canvas element for better event capture.
- Added stopPropagation() to prevent event bubbling and ensure events are handled at the correct level.
- Modified the main page.tsx to set a higher z-index for the fluid container.
- Added detailed logging to trace event propagation and coordinate transformations.
- Changed automatic test splats to use a hardcoded position (0.25, 0.25) for debugging.
- Removed turbopack flag from npm dev script to resolve 500 errors.

## Current Bug Investigation
- Fixed the issue where mouse-triggered splats weren't showing up at the correct position.
- Identified that the problem was related to event handling and propagation.
- Confirmed that the WebGL coordinate transformation is working correctly.
- Verified that the splat rendering pipeline is functioning properly.
- Resolved turbopack compatibility issues by switching to the standard Next.js development server.

## Next Steps
- Clean up debugging logs once the implementation is stable.
- Optimize performance by reducing unnecessary calculations.
- Consider adding more interactive features like color pickers or effect controls.
- Improve mobile touch support for better cross-device experience.
- Add visual indicators to show where clicks are being registered.
- Monitor for any additional compatibility issues with Next.js 15.3.0.

## Active Decisions and Considerations
- Using direct event handlers on the canvas element for precise interaction.
- Using stopPropagation() to prevent event bubbling and ensure events are handled at the correct level.
- Using a combination of React event handlers and native DOM event listeners for comprehensive event coverage.
- Balancing splat size and visibility against performance considerations.
- Maintaining detailed logging during development for easier debugging.
- Using the standard Next.js development server instead of turbopack for better stability.
