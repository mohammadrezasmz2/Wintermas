import { maskPrecipitationGl } from './precipitation-mask.js';

const vertexSource = `
attribute vec4 flake;
uniform vec2 viewport;
uniform mediump float scale;
varying float alpha;
void main() {
  vec2 p = flake.xy / viewport;
  gl_Position = vec4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);
  gl_PointSize = max(1.0, flake.z * scale * 3.15);
  alpha = flake.w;
}
`;
const fragmentSource = `
precision mediump float;
varying float alpha;
void main() {
  vec2 d = gl_PointCoord - vec2(0.5);
  float a = (1.0 - smoothstep(0.03, 0.5, length(d))) * alpha;
  gl_FragColor = vec4(vec3(0.89, 0.94, 1.0) * a, a);
}
`;

export function createSnowRenderer(canvas) {
  const gl = canvas.getContext('webgl', {
    alpha: true, antialias: false, depth: false, stencil: false,
    premultipliedAlpha: true, failIfMajorPerformanceCaveat: true,
  });
  if (!gl) return null;

  function shader(type, source) {
    const result = gl.createShader(type);
    gl.shaderSource(result, source);
    gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(result));
    return result;
  }

  const program = gl.createProgram();
  const vert = shader(gl.VERTEX_SHADER, vertexSource);
  const frag = shader(gl.FRAGMENT_SHADER, fragmentSource);
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  gl.useProgram(program);

  const data = new Float32Array(1800 * 4);
  const buffer = gl.createBuffer();
  const location = gl.getAttribLocation(program, 'flake');
  const viewport = gl.getUniformLocation(program, 'viewport');
  const scaleUniform = gl.getUniformLocation(program, 'scale');
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, 4, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);
  let scale = 1;
  let hadParticles = false;

  return {
    resize(width, height, nextScale) {
      scale = nextScale;
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(viewport, width, height);
      gl.uniform1f(scaleUniform, scale);
      hadParticles = false;
    },
    draw(particles, rectangles, taskbar) {
      if (!particles.length && !hadParticles) return;
      gl.clear(gl.COLOR_BUFFER_BIT);
      hadParticles = particles.length > 0;
      if (!hadParticles) return;
      const count = Math.min(particles.length, data.length / 4);
      for (let i = 0; i < count; i++) {
        const p = particles[i], offset = i * 4;
        data[offset] = p.x;
        data[offset + 1] = p.y;
        data[offset + 2] = p.size;
        data[offset + 3] = p.alpha;
      }
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.subarray(0, count * 4));
      gl.drawArrays(gl.POINTS, 0, count);
      maskPrecipitationGl(gl, rectangles, canvas, scale);
    },
  };
}

