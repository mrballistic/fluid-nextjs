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
  - `FluidSimulation.js`: Core logic for fluid simulation
  - `webgl/`: WebGL utilities and shader management
  - `utils/`: Helper utilities and logging

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
│           ├── utils/
│           │   └── logger.js
│           └── webgl/
│               ├── FramebufferManager.js
│               ├── ShaderManager.js
│               ├── shaders.js
│               └── WebGLContextManager.js
├── package.json
└── README.md
```

## 🧪 How It Works
The fluid simulation uses the Navier-Stokes equations to create realistic fluid dynamics. WebGL shaders perform the complex calculations on the GPU, allowing for smooth, real-time performance even with high-resolution simulations.

## 🎮 Interaction
- 🖱️ Click and drag to create fluid splats
- 💻 Watch as the fluid dynamically responds to your movements

## 📝 License
This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## 🙏 Acknowledgements
- Inspired by various WebGL fluid simulation techniques
- Built with Next.js, React, and WebGL
