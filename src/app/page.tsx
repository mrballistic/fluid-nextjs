// fluid-nextjs/src/app/page.tsx
"use client"; // Required for useEffect, useState, etc.

import dynamic from 'next/dynamic';
import React from 'react';
import styles from './page.module.css'; // Keep or modify styles as needed

// Dynamically import the Fluid component with SSR disabled
const FluidComponentWithNoSSR = dynamic(
  () => import('@/components/fluid/FluidComponent'), // Use the alias defined in tsconfig.json
  { ssr: false,
    loading: () => <p>Loading Fluid Simulation...</p> // Optional loading indicator
   }
);

// DebugUI component import removed

export default function Home() {
  return (
    <main className={styles.main}>
      <div 
        style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 10, overflow: 'hidden' }}
        onClick={(e) => {
          console.log("MAIN DIV CLICKED AT:", e.clientX, e.clientY);
        }}
        onMouseMove={(e) => {
          // Only log every 100 pixels moved to reduce spam
          if (e.clientX % 100 === 0 || e.clientY % 100 === 0) {
            console.log("MAIN DIV MOUSE MOVE:", e.clientX, e.clientY);
          }
        }}
      >
        <FluidComponentWithNoSSR style={{ width: '100%', height: '100%' }} />
      </div>
      
      {/* Debug UI component removed */}
      
      {/* You can add other page content here, ensure it's visible above the fluid background */}
    
    </main>
  );
}
