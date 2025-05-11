/**
 * Type of splat, either 'velocity' or 'dye'.
 */
type SplatType = 'velocity' | 'dye';

/**
 * Represents a splat with position, direction, color, and type.
 */
type Splat = {
  x: number;
  y: number;
  dx: number;
  dy: number;
  color?: [number, number, number];
  type: SplatType;
};

/**
 * Interface for a double frame buffer object (FBO).
 */
interface DoubleFBO {
  read: { texture: WebGLTexture; fbo: WebGLFramebuffer; attach: (id: number) => number };
  write: { texture: WebGLTexture; fbo: WebGLFramebuffer; attach: (id: number) => number };
  swap: () => void;
  texelSizeX: number;
  texelSizeY: number;
  width: number;
  height: number;
}

/**
 * Original splat force constant.
 */
const ORIGINAL_SPLAT_FORCE = 6000;

/**
 * Original splat radius constant.
 */
const ORIGINAL_SPLAT_RADIUS = 0.007;

export type { SplatType, Splat, DoubleFBO };
export { ORIGINAL_SPLAT_FORCE, ORIGINAL_SPLAT_RADIUS };
