const fs = require('fs');
const PDFParser = require("pdf2json");

const pdfParser = new PDFParser(this, 1);

pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError) );
pdfParser.on("pdfParser_dataReady", pdfData => {
  const text = pdfParser.getRawTextContent();
  console.log("Success:", text.substring(0, 100));
});

pdfParser.loadPDF("./test_resume.pdf");
