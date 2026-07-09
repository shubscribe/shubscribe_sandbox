const fs = require('fs');
const pdfParse = require('pdf-parse');

async function test() {
  const buf = fs.readFileSync('./test_resume.pdf');
  try {
    const data = await pdfParse(buf);
    console.log("Success:", data.text.substring(0, 100));
  } catch (e) {
    console.error("Error:", e.message);
  }
}
test();
