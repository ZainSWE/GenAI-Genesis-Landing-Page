// Bakes the skyline SVGs into code.js. Run: node design/figma-plugin/build.js
const fs = require("fs"), path = require("path");
const dir = path.join(__dirname, "..", "skyline");
const SVG = {};
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".svg"))) {
  let s = fs.readFileSync(path.join(dir, f), "utf8");
  s = s.replace(/<mask[\s\S]*?<\/mask>/g, "").replace(/ mask="[^"]*"/g, "");      // Figma's SVG import ignores masks
  const key = f.replace(/^skyline-/, "").replace(/\.svg$/, "");
  SVG[key] = s;
}
const src = fs.readFileSync(path.join(__dirname, "code.src.js"), "utf8");
fs.writeFileSync(path.join(__dirname, "code.js"), src.replace("__SVGS__", JSON.stringify(SVG)));
console.log("code.js written with", Object.keys(SVG).length, "SVGs:", Object.keys(SVG).join(", "));
