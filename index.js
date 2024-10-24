#!/usr/bin/env node

const fs = require("fs");
const { PDFDocument } = require("pdf-lib");
const path = require("path");
const os = require("os");

const excludedFields = ["hidden"];

async function extractFields(pdfPath) {
  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const form = pdfDoc.getForm();
  const fields = form.getFields();

  const fieldsObj = { numeric: [], nonNumeric: [] };
  fields.map((field) => {
    const fieldName = field.getName();
    if (excludedFields.includes(fieldName) || fieldName.startsWith('_')) {
      return;
    }

    const isNumeric = fieldName.match(/^\d/) || fieldName.match(/^\d+\$\d+$/);
    fieldsObj[isNumeric ? "numeric" : "nonNumeric"].push({
      name: fieldName,
      value: isNumeric ? fieldName : "",
    });
  });

  fieldsObj.numeric.sort((a, b) => Number(a.name) - Number(b.name));
  fieldsObj.nonNumeric.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, {
      ignorePunctuation: true,
      numeric: true,
    })
  );
  return [...fieldsObj.nonNumeric, ...fieldsObj.numeric].map(
    ({ name, value }) => `${name}": "${value}`
  );
}

async function saveFormFieldsAsJson(pdfPath) {
  const fieldData = await extractFields(pdfPath);

  const outputDir = path.join(os.homedir(), "Downloads", "pdf-to-json");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputFileName =
    path.basename(pdfPath, path.extname(pdfPath)) + ".json";
  const outputPath = path.join(outputDir, outputFileName);

  const json = JSON.stringify(fieldData, null, 2).replaceAll('\\"', '"');

  fs.writeFileSync(outputPath, `{${json.slice(1, -1)}}`);
  console.log(`JSON generated at location: ${outputPath}`);
}

const pdfFilePath = process.argv[2];

if (!pdfFilePath) {
  console.error("Please provide the base PDF to work with.");
  process.exit(1);
}

saveFormFieldsAsJson(pdfFilePath).catch((err) =>
  console.error("An error encountered during PDF to JSON parsing:", err)
);
