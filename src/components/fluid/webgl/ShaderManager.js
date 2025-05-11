// src/webgl/ShaderManager.js

/**
 * Adds #define keywords to the beginning of a shader source string.
 * @param {string} source - The original shader source code.
 * @param {string[]} [keywords] - An array of keywords to define.
 * @returns {string} The modified shader source code with keywords added.
 */
const addKeywords = (source, keywords) => {
  if (!keywords || keywords.length === 0) return source;
  let keywordsString = "";
  keywords.forEach((keyword) => {
    keywordsString += "#define " + keyword + "\n";
  });
  return keywordsString + source;
};

/**
 * Compiles a WebGL shader from source.
 * @param {WebGLRenderingContext} gl
 * @param {number} type - Shader type (gl.VERTEX_SHADER or gl.FRAGMENT_SHADER)
 * @param {string} source - GLSL source code
 * @param {string[]} [keywords] - An array of keywords to define.
 * @returns {WebGLShader} The compiled shader
 */
const compileShader = (gl, type, source, keywords) => {
  source = addKeywords(source, keywords);
  const shader = gl.createShader(type);
  if (!shader) {
    console.error("Failed to create shader object.");
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(`Shader compilation error: ${gl.getShaderInfoLog(shader)}\nShader source:\n${source}`);
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

/**
 * Creates a WebGL program by linking vertex and fragment shaders.
 * @param {WebGLRenderingContext} gl
 * @param {WebGLShader} vertexShader
 * @param {WebGLShader} fragmentShader
 * @returns {WebGLProgram} The linked WebGL program
 */
const createProgram = (gl, vertexShader, fragmentShader) => {
  if (!vertexShader || !fragmentShader) {
    console.error("Cannot create program: Invalid vertex or fragment shader provided.");
    return null;
  }

  let program = gl.createProgram();
  if (!program) {
    console.error("Failed to create program object.");
    return null;
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(`Program linking error: ${gl.getProgramInfoLog(program)}`);
    gl.deleteProgram(program);
    return null;
  }

  return program;
};

/**
 * WebGL Program wrapper for managing shader programs and uniforms.
 * @class
 */
class Program {
  constructor(gl, vertexShader, fragmentShader) {
    this.gl = gl;
    this.program = createProgram(gl, vertexShader, fragmentShader);
    if (!this.program) {
      throw new Error("Failed to create WebGL program.");
    }
    this.uniforms = this.getUniforms();
  }

  getUniforms() {
    const uniforms = {};
    const uniformCount = this.gl.getProgramParameter(this.program, this.gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < uniformCount; i++) {
      const uniformInfo = this.gl.getActiveUniform(this.program, i);
      if (uniformInfo) {
        const uniformName = uniformInfo.name.replace(/\[0\]$/, '');
        uniforms[uniformName] = this.gl.getUniformLocation(this.program, uniformName);
      }
    }
    return uniforms;
  }

  bind() {
    this.gl.useProgram(this.program);
  }

  dispose() {
    if (this.program) {
      this.gl.deleteProgram(this.program);
      this.program = null;
    }
  }
}

// Export classes and helper functions
/**
 * WebGL Material class for managing shaders and programs with keywords.
 * @class
 */
class Material {
  constructor(gl, vertexShader, fragmentShaderSource) {
    this.gl = gl;
    this.vertexShader = vertexShader;
    this.fragmentShaderSource = fragmentShaderSource;
    this.programs = {};
    this.activeProgram = null;
    this.uniforms = {};
  }

  setKeywords(keywords = []) {
    const sortedKeywords = [...keywords].sort();
    const key = sortedKeywords.length > 0 ? sortedKeywords.join("_") : "default";

    if (this.programs[key]) {
      this.activeProgram = this.programs[key];
      this.uniforms = this.activeProgram.uniforms;
      return;
    }

    const fragmentShader = compileShader(
      this.gl,
      this.gl.FRAGMENT_SHADER,
      this.fragmentShaderSource,
      sortedKeywords
    );

    if (!fragmentShader) {
      console.error("Failed to compile fragment shader with keywords:", sortedKeywords);
      return;
    }

    const programInstance = new Program(this.gl, this.vertexShader, fragmentShader);
    this.gl.deleteShader(fragmentShader);

    if (!programInstance.program) {
      console.error("Failed to create program with keywords:", sortedKeywords);
      return;
    }

    this.programs[key] = programInstance;
    this.activeProgram = programInstance;
    this.uniforms = programInstance.uniforms;
  }

  bind() {
    if (this.activeProgram) {
      this.activeProgram.bind();
    } else {
      console.error("No active program set. Call setKeywords first.");
    }
  }

  dispose() {
    for (const key in this.programs) {
      this.programs[key].dispose();
    }
    this.programs = {};
    this.activeProgram = null;
    this.uniforms = {};
  }
}

export { compileShader, createProgram, addKeywords, Program, Material };
