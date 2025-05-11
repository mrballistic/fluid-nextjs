type SplatType = 'velocity' | 'dye';

type Splat = {
  x: number;
  y: number;
  dx: number;
  dy: number;
  color?: [number, number, number];
  type: SplatType;
};

interface DoubleFBO {
  read: { texture: WebGLTexture; fbo: WebGLFramebuffer; attach: (id: number) => number };
  write: { texture: WebGLTexture; fbo: WebGLFramebuffer; attach: (id: number) => number };
  swap: () => void;
  texelSizeX: number;
  texelSizeY: number;
  width: number;
  height: number;
}

const ORIGINAL_SPLAT_FORCE = 6000;
const ORIGINAL_SPLAT_RADIUS = 0.007;

export type { SplatType, Splat, DoubleFBO };
export { ORIGINAL_SPLAT_FORCE, ORIGINAL_SPLAT_RADIUS };
