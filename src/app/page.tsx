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

// Dynamically import the DebugUI component with SSR disabled
const DebugUIWithNoSSR = dynamic(
  () => import('@/components/fluid/DebugUI'),
  { ssr: false }
);

export default function Home() {
  return (
    <main className={styles.main}>
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1, overflow: 'hidden' }}>
        <FluidComponentWithNoSSR style={{ width: '100%', height: '100%' }} />
      </div>
      
      {/* Separate Debug UI component */}
      <DebugUIWithNoSSR />
      
      {/* You can add other page content here, ensure it's visible above the fluid background */}
    
    </main>
  );
}
