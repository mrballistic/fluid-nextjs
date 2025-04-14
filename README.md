# 🌊 Fluid Simulation with Next.js and WebGL 🌊

## 🚀 Overview
This project integrates a GPU-accelerated fluid simulation into a Next.js application using WebGL. It provides interactive, visually appealing fluid dynamics rendered directly in the browser.

## ✨ Features
- 💧 Real-time fluid simulation leveraging WebGL shaders
- 🖱️ Interactive fluid dynamics responding to user input
- 🧩 Modular and maintainable code structure with clear separation of concerns
- 🎨 Beautiful visual effects with customizable parameters

## 📂 Project Structure
- `src/components/fluid`: Contains the main fluid simulation components
  - `FluidComponent.tsx`: React component integrating the fluid simulation
  - `FluidSimulation.js`: Main orchestration class for fluid simulation
  - `config/`: Configuration settings
    - `fluidConfig.js`: Default configuration for the fluid simulation
  - `webgl/`: WebGL utilities and shader management
    - `BlitManager.js`: WebGL rendering utilities
    - `FluidKernels.js`: Simulation step functions
    - `FramebufferManager.js`: Framebuffer creation and management
    - `RenderManager.js`: Rendering pipeline
    - `ShaderManager.js`: Shader compilation and program management
    - `SplatManager.js`: Splat creation functionality
    - `WebGLContextManager.js`: WebGL context initialization
    - `shaders.js`: Shader source code
  - `utils/`: Helper utilities and logging
    - `logger.js`: Logging utilities

## 🚀 Getting Started

### 📥 Installation
```bash
npm install
```

### 🛠️ Development
Run the development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) (or the next available port) to view the application.

### 🏗️ Production Build
Build the application for production:
```bash
npm run build
```

Start the production server:
```bash
npm start
```

## 📁 Project Structure
```
fluid-nextjs/
├── public/
├── src/
│   ├── app/
│   └── components/
│       └── fluid/
│           ├── FluidComponent.tsx
│           ├── FluidSimulation.js
│           ├── config/
│           │   └── fluidConfig.js
│           ├── utils/
│           │   └── logger.js
│           └── webgl/
│               ├── BlitManager.js
│               ├── FluidKernels.js
│               ├── FramebufferManager.js
│               ├── RenderManager.js
│               ├── ShaderManager.js
│               ├── SplatManager.js
│               ├── WebGLContextManager.js
│               └── shaders.js
├── package.json
└── README.md
```

## 🧪 How It Works
The fluid simulation uses the Navier-Stokes equations to create realistic fluid dynamics. WebGL shaders perform the complex calculations on the GPU, allowing for smooth, real-time performance even with high-resolution simulations.

The simulation is broken down into several steps:
1. 🔄 **Advection**: Moving quantities (dye and velocity) through the velocity field
2. 🌀 **Curl Calculation**: Computing the vorticity (curl) of the velocity field
3. 🔄 **Vorticity Confinement**: Enhancing small-scale vortices for more interesting flow
4. 📊 **Divergence Calculation**: Computing the divergence of the velocity field
5. 📈 **Pressure Solve**: Solving the pressure equation using Jacobi iteration
6. 🔄 **Gradient Subtraction**: Making the velocity field divergence-free
7. 🎨 **Rendering**: Visualizing the dye and velocity fields

Each of these steps is implemented in a separate module for better maintainability and clarity.

## 🎮 Interaction
- 🖱️ Click and drag to create fluid splats
- 💻 Watch as the fluid dynamically responds to your movements

## 📝 License
This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## 🙏 Acknowledgements
- Inspired by various WebGL fluid simulation techniques
- Built with Next.js, React, and WebGL
