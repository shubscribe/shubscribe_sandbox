const fs = require('fs');
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

async function test() {
  const buf = fs.readFileSync('/Users/shub/.gemini/antigravity/scratch/test.pdf');
  const data = await pdfParse(buf);
  console.log("Success:", data.text.substring(0, 100));
}
test();
