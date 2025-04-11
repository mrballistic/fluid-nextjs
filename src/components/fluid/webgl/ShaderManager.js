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
 * Compiles a shader of the given type with optional keywords.
 * @param {WebGL2RenderingContext | WebGLRenderingContext} gl - The WebGL rendering context.
 * @param {GLenum} type - The type of shader (VERTEX_SHADER or FRAGMENT_SHADER).
 * @param {string} source - The shader source code.
 * @param {string[]} [keywords] - Optional keywords to add to the shader source.
 * @returns {WebGLShader | null} The compiled shader object or null on failure.
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
    console.trace("Shader source:\n", source); // Log the source for debugging
    gl.deleteShader(shader); // Clean up shader on failure
    return null;
  }
  return shader;
};

/**
 * Creates a WebGL program by linking vertex and fragment shaders.
 * @param {WebGL2RenderingContext | WebGLRenderingContext} gl - The WebGL rendering context.
 * @param {WebGLShader} vertexShader - The compiled vertex shader.
 * @param {WebGLShader} fragmentShader - The compiled fragment shader.
 * @returns {WebGLProgram | null} The linked WebGL program or null on failure.
 */
const createProgram = (gl, vertexShader, fragmentShader) => {
  // Check if shaders are valid before proceeding
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
    gl.detachShader(program, vertexShader); // Detach shaders before deleting program
    gl.detachShader(program, fragmentShader);
    gl.deleteProgram(program); // Clean up program on failure
    return null;
  }

  // Optional: Validate program after linking (useful for debugging)
  gl.validateProgram(program);
   if (!gl.getProgramParameter(program, gl.VALIDATE_STATUS)) {
       console.error(`Program validation error: ${gl.getProgramInfoLog(program)}`);
       // Decide if validation failure should prevent returning the program
   }


  return program;
};

/**
 * Retrieves all active uniform locations for a given WebGL program.
 * @param {WebGL2RenderingContext | WebGLRenderingContext} gl - The WebGL rendering context.
 * @param {WebGLProgram} program - The WebGL program.
 * @returns {Object.<string, WebGLUniformLocation>} An object mapping uniform names to their locations.
 */
const getUniforms = (gl, program) => {
  let uniforms = {};
  let uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < uniformCount; i++) {
    const uniformInfo = gl.getActiveUniform(program, i);
    if (uniformInfo) {
        const uniformName = uniformInfo.name;
        // Handle uniform arrays (e.g., "name[0]")
        const uniformBaseName = uniformName.replace(/\[0\]$/, '');
        uniforms[uniformBaseName] = gl.getUniformLocation(program, uniformBaseName);
    } else {
        console.warn(`Could not get uniform info for index ${i}`);
    }
  }
  return uniforms;
};


/**
 * Represents a compiled and linked WebGL program with its uniforms.
 */
class Program {
  /**
   * Creates and links a WebGL program from vertex and fragment shader sources.
   * @param {WebGL2RenderingContext | WebGLRenderingContext} gl - The WebGL context.
   * @param {WebGLShader} vertexShader - Compiled vertex shader.
   * @param {WebGLShader} fragmentShader - Compiled fragment shader.
   */
  constructor(gl, vertexShader, fragmentShader) {
    this.gl = gl;
    this.uniforms = {};
    this.program = createProgram(gl, vertexShader, fragmentShader);
    if (this.program) {
      this.uniforms = getUniforms(gl, this.program);
    } else {
      // Error already logged in createProgram
      this.uniforms = {}; // Ensure uniforms is an empty object on failure
    }
  }

  /**
   * Binds the program for use.
   */
  bind() {
    if (this.program) {
        this.gl.useProgram(this.program);
    } else {
        console.error("Cannot bind a program that failed to link.");
    }
  }

  /**
   * Deletes the WebGL program.
   */
  dispose() {
    if (this.program) {
        this.gl.deleteProgram(this.program);
        this.program = null; // Prevent further use
    }
  }
}


/**
 * Manages multiple shader program variants based on keywords, using a shared vertex shader.
 */
class Material {
  /**
   * Initializes the material with a vertex shader and fragment shader source.
   * @param {WebGL2RenderingContext | WebGLRenderingContext} gl - The WebGL context.
   * @param {WebGLShader} vertexShader - The shared compiled vertex shader.
   * @param {string} fragmentShaderSource - The source code for the fragment shader.
   */
  constructor(gl, vertexShader, fragmentShaderSource) {
    this.gl = gl;
    this.vertexShader = vertexShader; // Assume vertex shader is pre-compiled and passed in
    this.fragmentShaderSource = fragmentShaderSource;
    this.programs = {}; // Cache for compiled program variants
    this.activeProgram = null; // The currently active program variant
    this.uniforms = {}; // Uniforms of the active program
  }

  /**
   * Sets the active program variant based on the provided keywords.
   * Compiles a new variant if it doesn't exist.
   * @param {string[]} keywords - An array of keywords to activate for the shader.
   */
  setKeywords(keywords = []) { // Default to empty array if undefined
    // Normalize keywords to ensure consistent caching
    const sortedKeywords = [...keywords].sort();
    const key = sortedKeywords.length > 0 ? sortedKeywords.join("_") : "default";

    if (this.programs[key]) {
      this.activeProgram = this.programs[key];
      this.uniforms = this.activeProgram.uniforms;
      return;
    }

    // Compile fragment shader with keywords
    let fragmentShader = compileShader(
      this.gl,
      this.gl.FRAGMENT_SHADER,
      this.fragmentShaderSource,
      sortedKeywords // Use sorted keywords for compilation
    );

    if (!fragmentShader) {
      console.error("Failed to compile fragment shader with keywords:", sortedKeywords);
      // Optionally try to fall back to default or handle error
      return;
    }

    // Create program using the shared vertex shader
    const programInstance = new Program(this.gl, this.vertexShader, fragmentShader);

    // Clean up the fragment shader as it's now linked into the program
    this.gl.deleteShader(fragmentShader);

    if (!programInstance.program) {
      console.error("Failed to create program with keywords:", sortedKeywords);
      // Optionally handle error
      return;
    }

    // Cache and set the new program as active
    this.programs[key] = programInstance;
    this.activeProgram = programInstance;
    this.uniforms = programInstance.uniforms;
  }

  /**
   * Binds the currently active program variant.
   */
  bind() {
    if (this.activeProgram) {
      this.activeProgram.bind();
    } else {
      console.error("No active program set. Call setKeywords first.");
    }
  }

  /**
   * Deletes all cached program variants associated with this material.
   */
  dispose() {
    for (const key in this.programs) {
      this.programs[key].dispose();
    }
    this.programs = {}; // Clear the cache
    this.activeProgram = null;
    this.uniforms = {};
  }
}

// Export classes and potentially helper functions if needed elsewhere
export { Program, Material, compileShader, createProgram, getUniforms };
