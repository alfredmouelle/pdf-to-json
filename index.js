#!/usr/bin/env node

const fs = require("fs");
const { PDFDocument, PDFField, PDFTextField } = require("pdf-lib");
const path = require("path");
const os = require("os");

const excludedFields = ["hidden"];

/**
 * @param {string} name
 * @returns
 */
function getIsNumeric(name) {
  return name.match(/^\d/);
}

/**
 * @param {{name: string, value: string}} field
 */
function parseT1(field) {
  const name = field.name;
  let value = field.value;
  const isNumeric = getIsNumeric(name);

  const realFieldCode = name.split("_")[0];

  if (name.toUpperCase().includes("_D")) {
    value = '•';
  } else if (name.toUpperCase().includes("_U")) {
    value = '⌊'
  }

  value = value + (isNumeric && name.includes('_') ? realFieldCode : '');

  return { name, value }
}

/**
 * @param {{name: string, value: string}} field
 */
function parseCO17(field) {
  const name = field.name;
  let value = field.value;
  const decimalNameSplit = name.toUpperCase().split("_D");
  const isNumeric = getIsNumeric(name);

  if (name === "num_auto") {
    value = "num_auto";
  } else if (name === "01a") {
    value = "01a";
  } else if (name === "01b") {
    value = "01b&0-9";
  } else if (name === "02") {
    value = "02";
  } else if (name === "05") {
    value = "∆05";
  } else {
    if (isNumeric) {
      const realFieldCode = name.split("_")[0];

      if (decimalNameSplit === 1) {
        value = `⌊${realFieldCode.split("#")[0]}`;
      } else {
        if (name.includes("_2_")) {
          value = `•${realFieldCode}`;
        } else if (name.endsWith("_1_")) {
          value = `⌊${realFieldCode}`;
        } else {
          value = name.toUpperCase().includes("_D")
            ? `•${realFieldCode.split("#")[0]}`
            : `⌊${realFieldCode.split("#")[0]}`;
        }
      }
    } else {
      if (name.toUpperCase().includes("_D")) {
        value = "•";
      } else if (name.toUpperCase().includes("_U")) {
        value = "⌊"
      }
    }
  }

  return { name, value };
}

/**
 * @param {PDFField[]} fields
 */
function parse(fields) {
  const fieldsObj = { numeric: [], nonNumeric: [] };

  const program =
    String(fields.find((field) => field.getName() === "_program")?.getText()) ||
    "";

  fields.map((field) => {
    const name = field.getName();
    if (excludedFields.includes(name) || name.startsWith("_")) {
      return;
    }

    const isNumeric = getIsNumeric(name);
    let value = isNumeric ? name.split("_")[0] : "";

    let current = { name, value };
    switch (program.toUpperCase()) {
      case "CO17":
        current = parseCO17({ name, value });
        break;
      case "T1":
        current = parseT1({ name, value });
        break;
      default:
        break;
    }

    fieldsObj[isNumeric ? "numeric" : "nonNumeric"].push(current);
  });

  return fieldsObj;
}

/**
 * @param {{numeric: PDFField[], nonNumeric: PDFField[]}} fieldsObj
 */
function toSorted(fieldsObj) {
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

async function extractFields(pdfPath) {
  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  return toSorted(parse(pdfDoc.getForm().getFields()));
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
