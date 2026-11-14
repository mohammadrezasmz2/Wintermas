// WebGL renderer for rain streaks. Each drop is a thin quad that fades from tail to head,
// with soft edges across its width so slanted streaks stay smooth instead of flickering.
const vertexSource = `
attribute vec4 point;
uniform vec2 viewport;
varying float alpha;
varying float side;
void main() {
  vec2 p = point.xy / viewport;
  gl_Position = vec4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);
  alpha = point.z;
  side = point.w;
}
`;
const fragmentSource = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec4 masks[4];
uniform float scale;
uniform float canvasHeight;
varying float alpha;
varying float side;
void main() {
  vec2 p = vec2(gl_FragCoord.x, canvasHeight - gl_FragCoord.y) / scale;
  for (int i = 0; i < 4; i++) {
    vec4 r = masks[i];
    if (p.x >= r.x && p.y >= r.y && p.x < r.z && p.y < r.w) discard;
  }
  float a = alpha * (1.0 - smoothstep(0.22, 1.0, abs(side)));
  gl_FragColor = vec4(vec3(0.76, 0.85, 0.97) * a, a);
}
`;

export const RAIN_GPU_BUDGET = 1600;

export function createRainRenderer(canvas) {
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

  const stride = 24; // 6 vertices * (x, y, alpha, side)
  const data = new Float32Array(RAIN_GPU_BUDGET * stride);
  const masks = new Float32Array(16);
  const buffer = gl.createBuffer();
  const location = gl.getAttribLocation(program, 'point');
  const viewport = gl.getUniformLocation(program, 'viewport');
  const scaleUniform = gl.getUniformLocation(program, 'scale');
  const heightUniform = gl.getUniformLocation(program, 'canvasHeight');
  const maskUniform = gl.getUniformLocation(program, 'masks[0]');
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, 4, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);
  let scale = 1;
  let hadDrops = false;

  function put(offset, x, y, alpha, side) {
    data[offset] = x;
    data[offset + 1] = y;
    data[offset + 2] = alpha;
    data[offset + 3] = side;
  }

  return {
    resize(width, height, nextScale) {
      scale = nextScale;
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(viewport, width, height);
      gl.uniform1f(scaleUniform, scale);
      gl.uniform1f(heightUniform, canvas.height);
      hadDrops = false;
    },
    clear() {
      gl.clear(gl.COLOR_BUFFER_BIT);
      hadDrops = false;
    },
    draw(drops, rectangles, taskbar) {
      if (!drops.length && !hadDrops) return;
      gl.clear(gl.COLOR_BUFFER_BIT);
      hadDrops = drops.length > 0;
      if (!hadDrops) return;
      masks.fill(0);
      if (!taskbar) {
        let i = 0;
        for (const rect of rectangles) {
          if (!rect.taskbar) continue;
          masks.set([rect.left, rect.top - 1, rect.right, rect.bottom], i);
          if ((i += 4) === masks.length) break;
        }
      }
      gl.uniform4fv(maskUniform, masks);
      const count = Math.min(drops.length, RAIN_GPU_BUDGET);
      const feather = 0.75 / scale;
      for (let i = 0; i < count; i++) {
        const d = drops[i];
        const speed = Math.hypot(d.vx, d.vy) || 1;
        const ux = d.vx / speed, uy = d.vy / speed;
        const tx = d.x - ux * d.length, ty = d.y - uy * d.length;
        const half = d.width * 0.5 + feather;
        const nx = -uy * half, ny = ux * half;
        const o = i * stride;
        put(o, tx + nx, ty + ny, 0, -1);
        put(o + 4, tx - nx, ty - ny, 0, 1);
        put(o + 8, d.x + nx, d.y + ny, d.alpha, -1);
        put(o + 12, d.x + nx, d.y + ny, d.alpha, -1);
        put(o + 16, tx - nx, ty - ny, 0, 1);
        put(o + 20, d.x - nx, d.y - ny, d.alpha, 1);
      }
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.subarray(0, count * stride));
      gl.drawArrays(gl.TRIANGLES, 0, count * 6);
    },
  };
}
