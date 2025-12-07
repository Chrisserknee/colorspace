// Script to generate PNG icons from SVG favicon
// Run with: node scripts/generate-icons.js

const fs = require('fs');
const path = require('path');

// Read the SVG
const svgPath = path.join(__dirname, '../public/favicon.svg');
const svgContent = fs.readFileSync(svgPath, 'utf8');

// Create a simple HTML file that generates the PNGs
const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Generate LumePet Icons</title>
</head>
<body>
  <h1>LumePet Icon Generator</h1>
  <p>Right-click each image and "Save image as..." to download:</p>
  
  <h3>apple-touch-icon.png (180x180)</h3>
  <canvas id="apple" width="180" height="180"></canvas>
  <br><br>
  
  <h3>icon-192.png (192x192)</h3>
  <canvas id="icon192" width="192" height="192"></canvas>
  <br><br>
  
  <h3>icon-512.png (512x512)</h3>
  <canvas id="icon512" width="512" height="512"></canvas>
  <br><br>
  
  <h3>favicon-32x32.png (32x32)</h3>
  <canvas id="fav32" width="32" height="32"></canvas>
  <br><br>
  
  <h3>favicon-16x16.png (16x16)</h3>
  <canvas id="fav16" width="16" height="16"></canvas>
  
  <script>
    const svgData = \`${svgContent.replace(/`/g, '\\`')}\`;
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    const img = new Image();
    img.onload = function() {
      const sizes = [
        { id: 'apple', size: 180 },
        { id: 'icon192', size: 192 },
        { id: 'icon512', size: 512 },
        { id: 'fav32', size: 32 },
        { id: 'fav16', size: 16 },
      ];
      
      sizes.forEach(({ id, size }) => {
        const canvas = document.getElementById(id);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);
      });
      
      URL.revokeObjectURL(url);
    };
    img.src = url;
  </script>
</body>
</html>
`;

// Write the HTML file
const htmlPath = path.join(__dirname, '../public/generate-icons.html');
fs.writeFileSync(htmlPath, html);

console.log('✅ Icon generator created at: public/generate-icons.html');
console.log('');
console.log('To generate PNG icons:');
console.log('1. Open http://localhost:3000/generate-icons.html in your browser');
console.log('2. Right-click each canvas and "Save image as..."');
console.log('3. Save them to the public/ folder with the correct names:');
console.log('   - apple-touch-icon.png');
console.log('   - icon-192.png');
console.log('   - icon-512.png');
console.log('   - favicon-32x32.png');
console.log('   - favicon-16x16.png');
console.log('');
console.log('Or use an online SVG to PNG converter like:');
console.log('https://svgtopng.com/');

