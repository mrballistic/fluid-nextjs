"use client";
import React, { useState, useEffect } from 'react';
import FluidComponentCore from '../../components/fluid/FluidComponentCorePart2';

export default function TestFluidPage() {
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    function handleResize() {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (windowSize.width === 0 || windowSize.height === 0) {
    return null; // or a loading indicator
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <FluidComponentCore width={windowSize.width} height={windowSize.height} />
      <div style={{ 
        position: 'absolute', 
        bottom: '20px', 
        left: '20px', 
        background: 'rgba(0,0,0,0.7)', 
        color: 'white', 
        padding: '10px' 
      }}>
        Interact with the fluid simulation by clicking and dragging on the canvas.
      </div>
    </div>
  );
}
