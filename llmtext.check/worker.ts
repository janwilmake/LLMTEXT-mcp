interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: {
    size: number;
    contentType: string;
    linkCount: number;
    validLinks: number;
  };
}

export async function validateLlmsTxt(
  baseUrl: string
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let metadata: ValidationResult["metadata"];

  try {
    // Validate base URL format
    let url: URL;
    try {
      url = new URL(baseUrl);
    } catch {
      errors.push("Invalid URL format");
      return { valid: false, errors, warnings };
    }

    // Check protocol
    if (url.protocol !== "https:") {
      errors.push("URL must use HTTPS protocol");
    }

    // Check path is exactly /llms.txt
    if (url.pathname !== "/llms.txt") {
      errors.push("Path must be exactly /llms.txt");
    }

    if (errors.length > 0) {
      return { valid: false, errors, warnings };
    }

    // Fetch the llms.txt file with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          // Accept: "text/plain, text/markdown, */*",
        },
      });
      clearTimeout(timeoutId);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        errors.push("Request timed out (>2 seconds)");
      } else {
        errors.push(
          `Network error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
      return { valid: false, errors, warnings };
    }

    if (!response.ok) {
      errors.push(`HTTP error: ${response.status} ${response.statusText}`);
      return { valid: false, errors, warnings };
    }

    // Check content type
    const contentType = response.headers.get("content-type") || "";
    const validContentTypes = ["text/plain", "text/markdown"];
    const isValidContentType = validContentTypes.some((type) =>
      contentType.toLowerCase().includes(type)
    );

    if (!isValidContentType) {
      errors.push(
        `Invalid content-type: ${contentType}. Expected text/plain or text/markdown`
      );
    }

    // Check content size
    const content = await response.text();
    const sizeInBytes = new TextEncoder().encode(content).length;

    if (sizeInBytes > 100 * 1024) {
      // 100KB
      errors.push(`Content too large: ${sizeInBytes} bytes (max 100KB)`);
    }

    // Extract markdown links using regex
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const links: string[] = [];
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      const linkUrl = match[2];
      // Normalize relative URLs
      try {
        const normalizedUrl = new URL(linkUrl, url.origin).toString();
        links.push(normalizedUrl);
      } catch {
        // If URL parsing fails, keep original (might be mailto: etc.)
        links.push(linkUrl);
      }
    }

    if (links.length === 0) {
      errors.push("No markdown links found in content");
    }

    // Test first 5 links
    let validLinks = 0;
    const linksToTest = links.slice(0, 5);

    for (const link of linksToTest) {
      try {
        // Skip non-http(s) links
        if (!link.startsWith("http://") && !link.startsWith("https://")) {
          continue;
        }

        const linkController = new AbortController();
        const linkTimeoutId = setTimeout(() => linkController.abort(), 2000);

        const linkResponse = await fetch(link, {
          signal: linkController.signal,
          headers: {
            Accept: "text/plain, text/markdown, */*",
          },
          method: "HEAD", // Use HEAD to avoid downloading full content
        });

        clearTimeout(linkTimeoutId);

        if (linkResponse.ok) {
          const linkContentType =
            linkResponse.headers.get("content-type") || "";
          const isValidLinkContentType = validContentTypes.some((type) =>
            linkContentType.toLowerCase().includes(type)
          );

          if (isValidLinkContentType) {
            validLinks++;
          }
        }
      } catch {
        // Silently continue - link validation failures are not critical
      }
    }

    if (linksToTest.length > 0 && validLinks === 0) {
      warnings.push("None of the tested links returned valid content-type");
    }

    metadata = {
      size: sizeInBytes,
      contentType: contentType,
      linkCount: links.length,
      validLinks: validLinks,
    };

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metadata,
    };
  } catch (error) {
    errors.push(
      `Unexpected error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
    return { valid: false, errors, warnings };
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>llms.txt Checker</title>
    <style>
        body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .form-group { margin-bottom: 20px; }
        input[type="url"] { width: 100%; padding: 10px; font-size: 16px; border: 1px solid #ddd; border-radius: 4px; }
        button { padding: 10px 20px; font-size: 16px; background: #007cba; color: white; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #005a85; }
        .result { margin-top: 20px; padding: 15px; border-radius: 4px; }
        .valid { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
        .invalid { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; }
        .error { color: #dc3545; margin: 5px 0; }
        .warning { color: #856404; margin: 5px 0; }
        .metadata { margin-top: 10px; font-size: 14px; color: #666; }
        #loading { display: none; }
    </style>
</head>
<body>
    <h1>llms.txt Checker</h1>
    <p>Validate llms.txt files according to the <a href="https://llmstxt.org/">llmstxt.org specification</a>.</p>
    
    <div class="form-group">
        <input type="url" id="urlInput" placeholder="https://example.com/llms.txt" required>
        <button onclick="checkUrl()">Check llms.txt</button>
    </div>
    
    <div id="loading">Checking...</div>
    <div id="result"></div>

    <script>
        async function checkUrl() {
            const input = document.getElementById('urlInput');
            const result = document.getElementById('result');
            const loading = document.getElementById('loading');
            
            const url = input.value.trim();
            if (!url) {
                alert('Please enter a URL');
                return;
            }
            
            loading.style.display = 'block';
            result.innerHTML = '';
            
            try {
                const response = await fetch('/check?url=' + encodeURIComponent(url));
                const data = await response.json();
                
                result.className = 'result ' + (data.valid ? 'valid' : 'invalid');
                result.innerHTML = \`
                    <h3>\${data.valid ? '✅ Valid' : '❌ Invalid'} llms.txt</h3>
                    \${data.errors.map(e => \`<div class="error">❌ \${e}</div>\`).join('')}
                    \${data.warnings.map(w => \`<div class="warning">⚠️ \${w}</div>\`).join('')}
                    \${data.metadata ? \`
                        <div class="metadata">
                            <strong>Metadata:</strong><br>
                            Size: \${data.metadata.size} bytes<br>
                            Content-Type: \${data.metadata.contentType}<br>
                            Links found: \${data.metadata.linkCount}<br>
                            Valid links tested: \${data.metadata.validLinks}
                        </div>
                    \` : ''}
                \`;
            } catch (error) {
                result.className = 'result invalid';
                result.innerHTML = \`<h3>❌ Error</h3><div class="error">Failed to check URL: \${error.message}</div>\`;
            }
            
            loading.style.display = 'none';
        }
        
        document.getElementById('urlInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                checkUrl();
            }
        });
    </script>
</body>
</html>`;

      return new Response(html, {
        headers: { "Content-Type": "text/html" },
      });
    }

    if (url.pathname === "/check") {
      const targetUrl = url.searchParams.get("url");

      if (!targetUrl) {
        return new Response(
          JSON.stringify({
            valid: false,
            errors: ["URL parameter is required"],
            warnings: [],
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const result = await validateLlmsTxt(targetUrl);

      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
};
