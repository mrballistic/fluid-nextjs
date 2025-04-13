"use client";
import React, { useEffect, useRef } from 'react';

export default function TestPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Get WebGL context
    const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }

    // Clear to black
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Create a simple vertex shader
    const vertexShaderSource = `
      attribute vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    // Create a simple fragment shader
    const fragmentShaderSource = `
      precision mediump float;
      uniform vec4 u_color;
      void main() {
        gl_FragColor = u_color;
      }
    `;

    // Create and compile shaders
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader!, vertexShaderSource);
    gl.compileShader(vertexShader!);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader!, fragmentShaderSource);
    gl.compileShader(fragmentShader!);

    // Create program and link shaders
    const program = gl.createProgram();
    gl.attachShader(program!, vertexShader!);
    gl.attachShader(program!, fragmentShader!);
    gl.linkProgram(program!);
    gl.useProgram(program!);

    // Create a buffer for the rectangle
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    // Create a click handler to draw rectangles
    const handleClick = (e: MouseEvent) => {
      // Convert click coordinates to WebGL coordinates (-1 to 1)
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / canvas.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / canvas.height) * 2 + 1;
      
      // Size of the rectangle
      const size = 0.1;
      
      // Create a rectangle at the click position
      const positions = [
        x - size, y - size,
        x + size, y - size,
        x - size, y + size,
        x - size, y + size,
        x + size, y - size,
        x + size, y + size,
      ];
      
      // Upload the rectangle data
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
      
      // Set up the position attribute
      const positionAttributeLocation = gl.getAttribLocation(program!, 'a_position');
      gl.enableVertexAttribArray(positionAttributeLocation);
      gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
      
      // Set a random color
      const colorUniformLocation = gl.getUniformLocation(program!, 'u_color');
      gl.uniform4f(colorUniformLocation, Math.random(), Math.random(), Math.random(), 1.0);
      
      // Draw the rectangle
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      
      console.log(`Drew rectangle at (${x}, ${y})`);
    };

    // Add click event listener
    canvas.addEventListener('click', handleClick);

    // Draw a rectangle in the center to start
    const positions = [
      -0.1, -0.1,
      0.1, -0.1,
      -0.1, 0.1,
      -0.1, 0.1,
      0.1, -0.1,
      0.1, 0.1,
    ];
    
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    
    const positionAttributeLocation = gl.getAttribLocation(program!, 'a_position');
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
    
    const colorUniformLocation = gl.getUniformLocation(program!, 'u_color');
    gl.uniform4f(colorUniformLocation, 1.0, 0.0, 0.0, 1.0);
    
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    
    console.log('Drew initial rectangle');

    // Cleanup
    return () => {
      canvas.removeEventListener('click', handleClick);
    };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <canvas 
        ref={canvasRef} 
        style={{ width: '100%', height: '100%' }}
      />
      <div style={{ 
        position: 'absolute', 
        bottom: '20px', 
        left: '20px', 
        background: 'rgba(0,0,0,0.7)', 
        color: 'white', 
        padding: '10px' 
      }}>
        Click anywhere to create a colored rectangle
      </div>
    </div>
  );
}
