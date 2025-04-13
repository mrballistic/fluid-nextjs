import React from 'react';
import logger from './utils/logger.js';

interface DebugUIProps {
  style?: React.CSSProperties;
}

const DebugUI: React.FC<DebugUIProps> = ({ style }) => {
  const [showDebug, setShowDebug] = React.useState(false);

  const handleDownloadLogs = () => {
    logger.downloadLogs();
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDebug(!showDebug);
    console.log("Debug button clicked, showDebug:", !showDebug);
  };

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleDownloadLogs();
    console.log("Download logs button clicked");
  };

  return (
    <div 
      id="debug-ui-container"
      style={{ 
        position: 'fixed', 
        top: '20px', 
        right: '20px', 
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        ...style
      }}
    >
      <button 
        id="debug-toggle-button"
        onClick={handleClick}
        style={{
          padding: '10px 15px',
          background: '#ff5500',
          color: 'white',
          border: '3px solid #ff7700',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 'bold',
          fontSize: '16px',
          boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
        }}
      >
        {showDebug ? 'HIDE DEBUG' : 'SHOW DEBUG'}
      </button>
      
      {showDebug && (
        <button 
          id="download-logs-button"
          onClick={handleDownloadClick}
          style={{
            padding: '10px 15px',
            background: '#0088ff',
            color: 'white',
            border: '3px solid #0066cc',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '16px',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
          }}
        >
          DOWNLOAD LOGS
        </button>
      )}
    </div>
  );
};

export default DebugUI;
