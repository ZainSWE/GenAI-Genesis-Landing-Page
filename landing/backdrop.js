/**
 * Page backdrop: a slow pastel "lava lamp" that reacts to the cursor, with
 * film grain on top. One full-screen fragment shader on its own small canvas
 * behind everything (the CSS gradient in .bg stays as the fallback).
 *
 * - Six blobs drift on their own paths; a seventh follows the cursor (smoothed)
 *   and swells with pointer speed. Blobs are simulated in JS: when the cursor
 *   blob (or another blob) bumps one, it is shoved aside, wobbles and springs
 *   back, so collisions read as liquid instead of fixed anchors.
 * - Rendered at reduced resolution; paused while the tab is hidden.
 * - Reduced motion: no drift, but it still answers the cursor.
 * - setWhite(k) fades the whole lamp toward white (used behind the subway map).
 * - setDark(on) eases the palette to deep purple / teal for dark mode.
 */
const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = `
precision mediump float;
uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse; uniform float uSpeed; uniform float uGrain; uniform float uWhite; uniform float uDark;
uniform vec2 uC[7]; uniform float uR[7];
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float asp = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  float t = uTime * 0.11;
  // organic wobble on the blob edges
  vec2 warp = vec2(fbm(p * 1.6 + t), fbm(p * 1.6 - t + 7.3)) - 0.5;
  vec2 m = vec2(uMouse.x * asp, uMouse.y);
  vec2 dm = p - m;
  float near = exp(-dot(dm, dm) * 9.0);
  vec2 q = p + warp * 0.22 + vec2(-dm.y, dm.x) * near * uSpeed * 0.6;   // cursor stirs the flow

  vec3 C0 = vec3(0.965, 0.77, 0.925);   // pink
  vec3 C1 = vec3(0.725, 0.59, 0.96);    // violet
  vec3 C2 = vec3(0.906, 0.776, 0.969);  // lilac
  vec3 C3 = vec3(0.80, 0.98, 0.95);     // mint mist
  vec3 C4 = vec3(1.0, 0.94, 0.985);     // white-pink
  vec3 C5 = vec3(0.69, 0.66, 0.97);     // periwinkle

  // dark mode: same blobs, deeper purple / magenta / teal
  C0 = mix(C0, vec3(0.36, 0.12, 0.42), uDark); C1 = mix(C1, vec3(0.22, 0.13, 0.52), uDark);
  C2 = mix(C2, vec3(0.30, 0.15, 0.46), uDark); C3 = mix(C3, vec3(0.05, 0.33, 0.36), uDark);
  C4 = mix(C4, vec3(0.12, 0.08, 0.26), uDark); C5 = mix(C5, vec3(0.16, 0.14, 0.48), uDark);
  vec3 col[7];
  col[0] = C0; col[1] = C1; col[2] = C2; col[3] = C3; col[4] = C5; col[5] = C4; col[6] = mix(C3, C0, 0.35);
  float field = 0.0; vec3 acc = vec3(0.0);
  for (int i = 0; i < 7; i++){ vec2 d = q - vec2(uC[i].x * asp, uC[i].y); float w = uR[i]*uR[i] / (dot(d, d) + 0.0008); field += w; acc += col[i] * w; }
  vec3 blob = acc / max(field, 1e-4);
  float lava = smoothstep(0.85, 1.55, field);
  float bk = uv.y + (fbm(p*0.8 + t*0.5) - 0.5) * 0.35;
  vec3 base = mix(mix(vec3(0.85, 0.82, 0.985), vec3(0.94, 0.905, 0.985), bk), mix(vec3(0.05, 0.03, 0.11), vec3(0.09, 0.05, 0.18), bk), uDark);
  vec3 colr = mix(base, blob, 0.35 + 0.55 * lava);
  colr += (smoothstep(1.4, 1.6, field) - smoothstep(1.6, 2.4, field)) * 0.035;  // soft rim on the blobs
  // white mode: same blobs and cursor response, washed almost to white
  vec3 pale = mix(mix(vec3(1.0, 0.996, 1.0), vec3(0.07, 0.05, 0.13), uDark), blob, 0.14 + 0.14 * lava);
  colr = mix(colr, pale, uWhite);
  colr += (hash(gl_FragCoord.xy + fract(uTime * 7.0) * 311.0) - 0.5) * uGrain * (1.0 - 0.55 * uWhite) * (1.0 - 0.3 * uDark);
  gl_FragColor = vec4(colr, 1.0);
}`;

export function createBackdrop({ reduced = false } = {}) {
  const canvas = document.createElement("canvas");
  canvas.className = "haze";
  canvas.setAttribute("aria-hidden", "true");
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power", preserveDrawingBuffer: false });
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (n) => gl.getUniformLocation(prog, n);
  const uRes = U("uRes"), uTime = U("uTime"), uMouse = U("uMouse"), uSpeed = U("uSpeed"), uGrain = U("uGrain"), uWhite = U("uWhite"), uDark = U("uDark"), uC = U("uC"), uR = U("uR");
  let white = 0, dark = 0, darkTarget = 0;

  // Blob simulation (normalised screen space, y up). home(t) = drifting path; d/v = collision offset.
  const BLOBS = [
    { x: 0.25, y: 0.30, ax: 0.20, ay: 0.20, fx: 0.23, fy: 0.19, r: 0.30 },
    { x: 0.80, y: 0.78, ax: 0.17, ay: 0.16, fx: 0.15, fy: 0.21, r: 0.34 },
    { x: 0.55, y: 0.55, ax: 0.26, ay: 0.26, fx: 0.12, fy: 0.16, r: 0.26 },
    { x: 0.12, y: 0.85, ax: 0.12, ay: 0.12, fx: 0.18, fy: 0.26, r: 0.22 },
    { x: 0.90, y: 0.18, ax: 0.10, ay: 0.16, fx: 0.29, fy: 0.13, r: 0.28 },
    { x: 0.42, y: 0.10, ax: 0.27, ay: 0.13, fx: 0.10, fy: 0.20, r: 0.24 },
  ].map((b, i) => ({ ...b, ph: i * 1.7, dx: 0, dy: 0, vx: 0, vy: 0, cx: b.x, cy: b.y }));
  const C = new Float32Array(14), R = new Float32Array(7);
  function simulate(time, dt, mx, my, mr) {
    const asp = canvas.width / canvas.height;
    for (const b of BLOBS) {
      const hx = b.x + b.ax * Math.sin(time * b.fx + b.ph) + 0.05 * Math.sin(time * b.fx * 2.7 + b.ph * 3.1);
      const hy = b.y + b.ay * Math.cos(time * b.fy + b.ph) + 0.05 * Math.cos(time * b.fy * 2.3 + b.ph * 1.3);
      // spring back to the path, damped
      b.vx += -b.dx * 2.2 * dt; b.vy += -b.dy * 2.2 * dt;
      // cursor blob shoves this blob when they overlap
      const ex = (hx + b.dx - mx) * asp, ey = hy + b.dy - my;
      const dist = Math.hypot(ex, ey) + 1e-4, reach = (b.r + mr) * 0.9;
      if (dist < reach) { const f = (reach - dist) / reach * 9.0 * dt; b.vx += (ex / dist) * f / asp; b.vy += (ey / dist) * f; }
      b.hx = hx; b.hy = hy;
    }
    // blobs nudge each other too (softly)
    for (let i = 0; i < BLOBS.length; i++) for (let j = i + 1; j < BLOBS.length; j++) {
      const a = BLOBS[i], b = BLOBS[j];
      const ex = ((a.hx + a.dx) - (b.hx + b.dx)) * asp, ey = (a.hy + a.dy) - (b.hy + b.dy);
      const dist = Math.hypot(ex, ey) + 1e-4, reach = (a.r + b.r) * 0.55;
      if (dist < reach) { const f = (reach - dist) / reach * 2.0 * dt; a.vx += ex / dist * f / asp; a.vy += ey / dist * f; b.vx -= ex / dist * f / asp; b.vy -= ey / dist * f; }
    }
    BLOBS.forEach((b, i) => {
      b.vx *= Math.pow(0.18, dt); b.vy *= Math.pow(0.18, dt);
      b.dx = Math.max(-0.45, Math.min(0.45, b.dx + b.vx * dt * 2.4));
      b.dy = Math.max(-0.45, Math.min(0.45, b.dy + b.vy * dt * 2.4));
      C[i * 2] = b.hx + b.dx; C[i * 2 + 1] = b.hy + b.dy; R[i] = b.r;
    });
    C[12] = mx; C[13] = my; R[6] = mr;
  }

  const scale = Math.min(1, (devicePixelRatio || 1) * 0.6);
  function resize() {
    canvas.width = Math.max(2, Math.round(innerWidth * scale));
    canvas.height = Math.max(2, Math.round(innerHeight * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  addEventListener("resize", resize);

  const target = { x: 0.62, y: 0.55 }, mouse = { x: 0.62, y: 0.55 };
  let speed = 0, lastMove = 0;
  addEventListener("pointermove", (e) => {
    const nx = e.clientX / innerWidth, ny = 1 - e.clientY / innerHeight;
    const dist = Math.hypot(nx - target.x, ny - target.y);
    speed = Math.min(1.5, speed + dist * 6);
    target.x = nx; target.y = ny; lastMove = performance.now();
    if (reduced) draw(0);
  }, { passive: true });

  let t0 = performance.now(), running = true, lastT = 0;
  function draw(time) {
    const dt = Math.min(0.05, Math.max(0, time - lastT)) || 0.016; lastT = time;
    // idle: the cursor blob keeps wandering gently around where the pointer rests
    const idle = Math.min(1, Math.max(0, (performance.now() - lastMove - 1500) / 2000));
    const wx = target.x + idle * 0.06 * Math.sin(time * 0.7), wy = target.y + idle * 0.05 * Math.cos(time * 0.55);
    mouse.x += (wx - mouse.x) * 0.06;
    mouse.y += (wy - mouse.y) * 0.06;
    speed *= 0.95;
    const mx = reduced ? target.x : mouse.x, my = reduced ? target.y : mouse.y;
    simulate(reduced ? 0 : time, reduced ? 0.016 : dt, mx, my, 0.16 + speed * 0.12);
    gl.uniform2fv(uC, C); gl.uniform1fv(uR, R);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, reduced ? 0 : time);
    gl.uniform2f(uMouse, mx, my);
    gl.uniform1f(uSpeed, speed);
    gl.uniform1f(uGrain, 0.085);
    dark += (darkTarget - dark) * (reduced ? 1 : 0.08);
    gl.uniform1f(uWhite, white);
    gl.uniform1f(uDark, dark);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function loop(now) {
    if (!running) return;
    draw((now - t0) / 1000);
    requestAnimationFrame(loop);
  }
  document.addEventListener("visibilitychange", () => {
    if (reduced) return;
    running = !document.hidden;
    if (running) requestAnimationFrame(loop);
  });
  if (reduced) draw(0); else requestAnimationFrame(loop);
  function setWhite(k) {
    k = Math.min(1, Math.max(0, k));
    if (Math.abs(k - white) < 0.002) return;
    white = k;
    if (reduced) draw(0);
  }
  function setDark(on, instant = false) {
    darkTarget = on ? 1 : 0;
    if (instant) dark = darkTarget;
    if (reduced) draw(0);
  }
  return { canvas, setWhite, setDark };
}
