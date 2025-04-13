// src/components/fluid/utils.js

export const getResolution = (resolution, gl) => {
  if (!gl) return { width: 0, height: 0 };
  let aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
  if (aspectRatio < 1) aspectRatio = 1.0 / aspectRatio;
  const min = Math.round(resolution);
  const max = Math.round(resolution * aspectRatio);
  if (gl.drawingBufferWidth > gl.drawingBufferHeight)
    return { width: max, height: min };
  else return { width: min, height: max };
};

export const correctRadius = (radius, gl) => {
  // Return a fixed large radius regardless of canvas size
  // This ensures splats are always visible
  return 0.1; // Fixed large radius that will be visible on any canvas size
};
