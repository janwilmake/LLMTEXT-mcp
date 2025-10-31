#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    return null;
  }
}

function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, "utf8");
}

function getHostname(args) {
  // Check for --hostname flag
  const hostnameIndex = args.indexOf("--hostname");
  if (hostnameIndex !== -1 && hostnameIndex + 1 < args.length) {
    return args[hostnameIndex + 1];
  }

  // Try to read from CNAME file
  const cname = readFile("CNAME");
  if (cname) {
    return cname.trim();
  }

  throw new Error(
    "No hostname provided. Use --hostname or create a CNAME file"
  );
}

function getOutputFile(args) {
  const outputIndex = args.indexOf("-o");
  if (outputIndex !== -1 && outputIndex + 1 < args.length) {
    return args[outputIndex + 1];
  }
  return "llms.txt";
}

function getFilenameWithoutExtension(filePath) {
  const basename = path.basename(filePath);
  const lastDotIndex = basename.lastIndexOf(".");
  const filename =
    lastDotIndex === -1 ? basename : basename.substring(0, lastDotIndex);
  if (filename === "") return basename;
  return filename;
}

function main() {
  const args = process.argv.slice(2);

  try {
    // Read manifest.json
    const manifestContent = readFile("manifest.json");
    if (!manifestContent) {
      throw new Error("manifest.json not found in current working directory");
    }

    const manifest = JSON.parse(manifestContent);

    // Read README.md
    const readmeContent = readFile("README.md");
    if (!readmeContent) {
      throw new Error("README.md not found in current working directory");
    }

    // Get hostname
    const hostname = getHostname(args);

    // Get output file
    const outputFile = getOutputFile(args);

    // Generate files section
    let filesSection = "\n# Files\n\n";

    for (const filePath in manifest) {
      const filename = getFilenameWithoutExtension(filePath);
      const url = `https://${hostname}${filePath}`;
      filesSection += `[${filename}](${url})\n`;
    }

    // Combine README with files section
    const output = readmeContent + filesSection;

    // Write output
    writeFile(outputFile, output);

    console.log(
      `Generated ${outputFile} with ${Object.keys(manifest).length} file links`
    );
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

main();
