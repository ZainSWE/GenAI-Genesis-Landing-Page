/**
 * "We had the world over": the Earth the snow globe turns into.
 *
 * Same illustration look as the city: flat two-tone shading, pastel aqua water
 * (the snow globe's lake), lilac-white land and a glass rim. Built at
 * radius 1 and drawn with its own orthographic camera (city.js), so the big horizon
 * stays a clean arc with no perspective stretch: first it sits inside the snow globe,
 * then it swells into a horizon along the bottom of the screen.
 *
 * It starts as the snow globe's glass: setReveal(k) frosts the glass over into the
 * planet from the top down, with a bright edge on the front. Scroll turns it left to
 * right and front to back at the same time, from the first frost through the map
 * (setScroll(c) takes the page's chapter position, setProgress(f) the map's station
 * progress), eased so it never snaps, with a slow idle turn on top.
 */
import * as THREE from "three";
import LAND from "./globe-land.js";

const D2R = Math.PI / 180;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export function createGlobe({ night }) {
  const root = new THREE.Group();    // placed / scaled / faced by city.js
  const tilt = new THREE.Group();    // tips the current country up toward the horizon's crest
  const yaw = new THREE.Group();     // turns left to right
  const roll = new THREE.Group();    // turns front to back (about the screen's horizontal axis)
  const spin = new THREE.Group();    // the planet itself, Americas facing out at the start
  root.add(tilt); tilt.add(yaw); yaw.add(roll); roll.add(spin);
  root.visible = false;

  const C = (h) => new THREE.Color(h);
  const tex = new THREE.TextureLoader().load(LAND);
  tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = 8; tex.generateMipmaps = true;
  const U = {
    uLand: { value: tex }, uNight: night, uReveal: { value: 1 },
    uLight: { value: new THREE.Vector3(-0.35, 0.8, 0.5).normalize() },
    // light mode            dark mode
    uSeaLit: { value: C("#E6FBF8") },  uSeaLitN: { value: C("#2B2063") },
    uSeaSh:  { value: C("#C0ECE9") },  uSeaShN:  { value: C("#1A1244") },
    uLandLit:{ value: C("#F1EBFF") },  uLandLitN:{ value: C("#7C68DA") },
    uLandSh: { value: C("#C6B2F4") },  uLandShN: { value: C("#4B3BA2") },
    uShore:  { value: C("#FFFFFF") },  uShoreN:  { value: C("#3FE3D6") },
  };
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 160, 112), new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `varying vec2 vUv; varying vec3 vNw; varying vec3 vV; varying float vLat; varying vec3 vP;
      void main(){
        vUv = uv; vLat = position.y; vP = position;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vNw = normalize(mat3(modelMatrix) * normal); vV = vec3(0.0, 0.0, 1.0);   // orthographic camera looks down −z
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `uniform sampler2D uLand; uniform float uNight; uniform vec3 uLight; uniform float uReveal;
      uniform vec3 uSeaLit, uSeaSh, uLandLit, uLandSh, uShore, uSeaLitN, uSeaShN, uLandLitN, uLandShN, uShoreN;
      varying vec2 vUv; varying vec3 vNw; varying vec3 vV; varying float vLat; varying vec3 vP;
      float landAt(vec2 uv){ return texture2D(uLand, uv).r; }
      float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float vnoise(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
      void main(){
        vec3 n = normalize(vNw);
        // frost-over: the glass fills in from the top down (screen up = +y), with a ragged frosty front
        float key = mix((1.0 - n.y) * 0.5, vnoise(vP * 5.0) * 0.6 + vnoise(vP * 13.0) * 0.4, 0.3);
        float th = uReveal * 1.12;
        if (key > th) discard;
        float front = smoothstep(th - 0.07, th, key) * step(uReveal, 0.999);
        float m = landAt(vUv);
        float w = max(fwidth(m) * 0.75, 0.002);
        float land = smoothstep(0.5 - w, 0.5 + w, m);
        // soft drop shadow of the land on the water, so continents read as raised tiles
        float sh = smoothstep(0.42, 0.58, landAt(vUv + vec2(-0.0016, 0.0026))) * (1.0 - land);
        // thin bright shore line just outside the coast
        float shore = (smoothstep(0.2, 0.42, m) - smoothstep(0.42, 0.5, m)) * (1.0 - land);
        // two-tone light, like the buildings
        float lit = smoothstep(0.1, 0.22, dot(n, uLight));   // crisp split, like the buildings' lit / shadow sides
        vec3 sea = mix(mix(uSeaSh, uSeaLit, lit), mix(uSeaShN, uSeaLitN, lit), uNight);
        vec3 grd = mix(mix(uLandSh, uLandLit, lit), mix(uLandShN, uLandLitN, lit), uNight);
        sea = mix(sea, mix(uSeaSh, uSeaShN, uNight) * mix(0.9, 0.8, uNight), sh * 0.55);
        sea = mix(sea, mix(uShore, uShoreN, uNight), shore * mix(0.7, 0.45, uNight));
        vec3 col = mix(sea, grd, land);
        // glassy limb, echoing the snow globe
        float f = pow(1.0 - max(dot(n, normalize(vV)), 0.0), 2.4);
        col = mix(col, mix(vec3(1.0), vec3(0.62, 0.98, 0.94), uNight), f * mix(0.5, 0.35, uNight));
        col = mix(col, mix(vec3(1.0), vec3(0.75, 1.0, 0.97), uNight), front * 0.85);   // bright frosty edge while it forms
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  sphere.rotation.y = -Math.PI / 2;   // three's sphere UVs start at +x; puts lon 0 facing +z
  spin.add(sphere);

  // glass halo just outside the limb (in root, so it doesn't turn)
  const rim = new THREE.Mesh(new THREE.SphereGeometry(1.035, 96, 64), new THREE.ShaderMaterial({
    uniforms: { uNight: night, uReveal: U.uReveal }, transparent: true, depthWrite: false, side: THREE.BackSide,
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = vec3(0.0, 0.0, 1.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uNight; uniform float uReveal; varying vec3 vN; varying vec3 vV;
      void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float a = smoothstep(0.62, 1.0, f) * (1.0 - smoothstep(0.9, 1.0, f));
        gl_FragColor = vec4(mix(vec3(0.9, 1.0, 0.99), vec3(0.4, 0.95, 0.88), uNight), a * mix(0.6, 0.45, uNight) * uReveal); }`,
  }));
  rim.renderOrder = 4;
  root.add(rim);

  // scroll turns the planet both ways at once; eased toward the scroll position so it never snaps
  const LAT0 = 0.3, LON0 = -80;   // tipped to show the north a little; starts over the Americas
  spin.rotation.set(LAT0, -(LON0 * D2R), 0, "XYZ");
  let prog = 0, scrollC = 0, t = 0, ang = 0;
  const SPIN = 0.6;   // overall turn speed (scroll-driven and idle alike)
  function setProgress(f) { prog = Math.max(0, f); }
  function setScroll(c) { scrollC = c; }
  function setTilt(a) { tilt.rotation.x = -a; }
  function setReveal(k) { U.uReveal.value = clamp(k); }
  function tick(dt) {
    t += dt;
    const target = (clamp(scrollC - 3.28, 0, 1) * 2.4 + prog * 0.24) * SPIN;   // turning through the transition, then along the map
    ang += (target - ang) * (1 - Math.exp(-dt * 4));
    yaw.rotation.y = -(ang * 0.8 + t * 0.07 * SPIN);     // left to right
    roll.rotation.x = -(ang * 0.55 + t * 0.045 * SPIN);  // front to back: the near side travels up and over the horizon
  }
  function setTheme() {}   // colours follow the shared night uniform
  return { group: root, setProgress, setScroll, setTilt, setReveal, tick, setTheme };
}
