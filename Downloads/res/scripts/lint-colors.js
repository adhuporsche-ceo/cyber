const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'public');
const extensions = new Set(['.css', '.js', '.html', '.svg']);
const allowedHex = new Set(['#000', '#000000', '#fff', '#ffffff', '#f5faff', '#e6f1ff', '#c9e0f7', '#2f80ed', '#0b4f9c', '#12355b', '#2ca6c9']);
const colorFunctions = /\b(?:rgb|rgba|hsl|hsla)\s*\(/gi;
const forbiddenEffects = /\b(?:linear-gradient|radial-gradient|conic-gradient|blur)\s*\(|\bopacity\s*:\s*[^;]+|\bfilter\s*:/gi;
const namedColors = /(?:^|[\s:(,])(?:red|green|blue|yellow|orange|purple|pink|gray|grey|brown|teal|navy|lime|cyan|magenta|gold|silver)(?:$|[\s;),])/i;

function filesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(fullPath) : extensions.has(path.extname(entry.name).toLowerCase()) ? [fullPath] : [];
  });
}

const violations = [];
for (const file of filesIn(root)) {
  const relative = path.relative(process.cwd(), file);
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    const hexes = line.match(/#[0-9a-f]{3,8}\b/gi) || [];
    hexes.filter((hex) => !allowedHex.has(hex.toLowerCase())).forEach((hex) => violations.push(`${relative}:${index + 1} forbidden color ${hex}`));
    if (colorFunctions.test(line)) violations.push(`${relative}:${index + 1} forbidden color function`);
    colorFunctions.lastIndex = 0;
    if (forbiddenEffects.test(line)) violations.push(`${relative}:${index + 1} forbidden opacity/gradient/filter effect`);
    forbiddenEffects.lastIndex = 0;
    if (namedColors.test(line)) violations.push(`${relative}:${index + 1} forbidden named color`);
  });
}

if (violations.length) {
  console.error(`Color lint failed with ${violations.length} violation(s):`);
  console.error(violations.join('\n'));
  process.exit(1);
}
console.log('Color lint passed: public uses only approved monochrome and reference palette tokens.');
