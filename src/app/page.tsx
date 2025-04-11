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

export default function Home() {
  return (
    <main className={styles.main}>
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1 }}>
        <FluidComponentWithNoSSR style={{ width: '100%', height: '100%' }} />
      </div>
      {/* You can add other page content here, ensure it's visible above the fluid background */}
      <div className={styles.center} style={{ zIndex: 1, position: 'relative', color: 'white', background: 'rgba(0,0,0,0.5)', padding: '20px', borderRadius: '10px' }}>
        <h1>Fluid Simulation</h1>
        <p>Interact by clicking/tapping and dragging.</p>
      </div>
    </main>
  );
}
