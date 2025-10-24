async function updateIndexHtml() {
  try {
    console.log("Fetching index.json...");
    const response = await fetch("https://mcp.llmtext.com/index.json");
    const jsonData = await response.json();
    jsonData.servers = jsonData.servers;
    console.log("Reading index.html...");
    const fs = await import("fs");
    let html = fs.readFileSync("./index.html", "utf8");

    // Find and replace the window.data line
    const dataString = JSON.stringify(jsonData);
    const windowDataRegex = /window\.data\s*=\s*\{[^}]*"users"[^;]*;/;

    if (!windowDataRegex.test(html)) {
      throw new Error("Could not find window.data in index.html");
    }

    html = html.replace(windowDataRegex, `window.data = ${dataString};`);

    console.log("Writing updated index.html...");
    fs.writeFileSync("./index.html", html, "utf8");

    console.log("✅ Successfully updated index.html with fresh data");
    console.log(`   - Servers: ${jsonData.servers?.length || 0}`);
    console.log(`   - Users: ${jsonData.users?.length || 0}`);
  } catch (error) {
    console.error("❌ Error updating index.html:", error.message);
    process.exit(1);
  }
}

updateIndexHtml();
