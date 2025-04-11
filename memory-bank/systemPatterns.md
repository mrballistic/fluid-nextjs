# System Patterns: Fluid NextJS

## System Architecture
Fluid NextJS follows a modular architecture, separating concerns between simulation logic, WebGL rendering, and frontend integration. The architecture consists of:

- **WebGL Layer**: Manages low-level graphics rendering, shaders, and framebuffers.
- **Simulation Layer**: Implements fluid dynamics logic and interacts with the WebGL layer.
- **Frontend Layer**: Built with Next.js, providing interactive UI components and integrating the simulation.

## Key Technical Decisions
- **Next.js**: Chosen for its performance, ease of use, and built-in support for modern web development practices.
- **WebGL**: Selected for its capability to deliver high-performance graphics rendering directly in browsers.
- **Shader Management**: Centralized shader management to streamline shader compilation, linking, and usage.
- **Framebuffer Management**: Efficient handling of framebuffers to optimize rendering performance.

## Design Patterns in Use
- **Singleton Pattern**: Used for managing WebGL context to ensure a single, consistent context throughout the application.
- **Factory Pattern**: Employed in shader and framebuffer management to create and manage WebGL resources efficiently.
- **Component-Based Architecture**: Leveraged through Next.js components to encapsulate simulation logic and UI elements.

## Component Relationships
- **WebGLContextManager**: Singleton managing the WebGL context lifecycle.
- **ShaderManager**: Factory responsible for compiling, linking, and managing shader programs.
- **FramebufferManager**: Factory managing framebuffer objects for off-screen rendering.
- **FluidSimulation**: Core simulation logic interacting with WebGL components.
- **FluidComponent**: Next.js frontend component integrating the simulation into the user interface.
