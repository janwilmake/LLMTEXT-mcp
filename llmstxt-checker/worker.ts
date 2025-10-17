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
    <title>llms.txt Checker - Parallel.ai</title>
    <meta name="description" content="Validate llms.txt files according to the llmstxt.org specification.">
    <link rel="icon" href="/dark-parallel-symbol-270.png">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif;
            background: #fafafa;
            color: #1d1d1f;
            line-height: 1.47059;
            font-weight: 400;
            letter-spacing: -0.022em;
        }

        .brand-header {
            position: absolute;
            top: 20px;
            left: 20px;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            z-index: 10;
        }

        .brand-logo {
            background-color: #4fc1ae;
            padding: 0 5px;
            border-radius: 2px;
            font-size: 28px;
            font-weight: 700;
            color: #1d1d1f;
            text-decoration: none;
            letter-spacing: -0.02em;
            margin-bottom: 2px;
        }

        .brand-by {
            font-size: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            color: #86868b;
            margin-bottom: 4px;
            font-weight: 400;
        }

        .parallel-logo {
            height: 12px;
            width: auto;
            margin-bottom: 2px;
        }

        .read-more {
            font-size: 12px;
            color: #007aff;
            text-decoration: none;
            font-weight: 500;
            transition: color 0.2s ease;
        }

        .read-more:hover {
            color: #0051d0;
        }

        .container {
            max-width: 980px;
            margin: 0 auto;
            padding: 80px 20px;
        }

        h1 {
            font-size: 48px;
            font-weight: 600;
            letter-spacing: -0.005em;
            text-align: center;
            margin-top: 24px;
            margin-bottom: 24px;
            color: #1d1d1f;
        }

        .subtitle {
            font-size: 21px;
            font-weight: 400;
            text-align: center;
            margin-bottom: 40px;
            color: #86868b;
        }

        .form-section {
            background: white;
            border-radius: 18px;
            padding: 48px;
            margin-bottom: 40px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        }

        .input-group {
            display: flex;
            gap: 12px;
            align-items: center;
        }

        input[type="url"] {
            flex: 1;
            font-size: 17px;
            padding: 16px 20px;
            border: 2px solid #d2d2d7;
            border-radius: 12px;
            background: #f5f5f7;
            transition: all 0.2s ease;
            font-family: inherit;
        }

        input[type="url"]:focus {
            outline: none;
            border-color: #007aff;
            background: white;
        }

        .check-btn {
            background: #007aff;
            color: white;
            border: none;
            padding: 16px 32px;
            border-radius: 12px;
            font-size: 17px;
            font-weight: 590;
            cursor: pointer;
            transition: all 0.2s ease;
            white-space: nowrap;
        }

        .check-btn:hover {
            background: #0051d0;
            transform: translateY(-1px);
        }

        .check-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .result {
            background: white;
            border-radius: 18px;
            padding: 48px;
            margin-top: 32px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        }

        .valid {
            border-left: 4px solid #34c759;
        }

        .invalid {
            border-left: 4px solid #ff3b30;
        }

        .result h3 {
            font-size: 32px;
            font-weight: 600;
            margin-bottom: 24px;
            text-align: center;
        }

        .valid h3 {
            color: #34c759;
        }

        .invalid h3 {
            color: #ff3b30;
        }

        .error {
            color: #ff3b30;
            margin: 12px 0;
            font-size: 16px;
        }

        .warning {
            color: #ff9500;
            margin: 12px 0;
            font-size: 16px;
        }

        .metadata {
            margin-top: 24px;
            padding-top: 24px;
            border-top: 1px solid #f5f5f7;
            font-size: 16px;
            color: #86868b;
        }

        .metadata strong {
            color: #007aff;
        }

        #loading {
            display: none;
            text-align: center;
            font-size: 16px;
            color: #86868b;
            margin-top: 20px;
        }

        /* Mobile styles */
        @media (max-width: 768px) {
            .brand-header {
                position: static;
                align-items: center;
                margin-bottom: 30px;
            }

            .brand-logo {
                font-size: 32px;
                padding: 2px 8px;
            }

            .brand-by {
                font-size: 10px;
            }

            .parallel-logo {
                height: 14px;
            }

            .read-more {
                font-size: 14px;
            }

            .container {
                padding: 40px 16px;
            }

            h1 {
                font-size: 36px;
                line-height: 1.1;
                margin-top: 0px;
                margin-bottom: 16px;
            }

            .subtitle {
                font-size: 18px;
                margin-bottom: 30px;
                padding: 0 10px;
            }

            .form-section,
            .result {
                padding: 24px 20px;
                border-radius: 16px;
                margin-bottom: 20px;
            }

            .input-group {
                flex-direction: column;
                gap: 16px;
            }

            input[type="url"] {
                width: 100%;
                font-size: 16px;
                padding: 14px 16px;
            }

            .check-btn {
                width: 100%;
                padding: 14px 24px;
                font-size: 16px;
            }
        }

        @media (max-width: 480px) {
            .container {
                padding: 30px 12px;
            }

            h1 {
                font-size: 30px;
            }

            .subtitle {
                font-size: 16px;
            }

            .form-section,
            .result {
                padding: 20px 16px;
            }

            .brand-logo {
                font-size: 28px;
            }
        }
    </style>
</head>
<body>
    <!-- Header with same design as llmtext -->
    <div class="brand-header">
        <a href="/" class="brand-logo">LLMTEXT</a>
        <span class="brand-by">by <img src="/dark-parallel-text-270.svg" alt="Parallel AI" class="parallel-logo" /></span>
        <a href="https://parallel.ai/blog" class="read-more" target="_blank">read more &gt;</a>
    </div>

    <div class="container">
        <h1>llms.txt Checker</h1>
        <p class="subtitle">Validate llms.txt files according to the <a href="https://llmstxt.org/" target="_blank" style="color: #007aff; text-decoration: none;">llmstxt.org specification</a>.</p>
        
        <div class="form-section">
            <div class="input-group">
                <input type="url" id="urlInput" placeholder="https://example.com/llms.txt" required>
                <button onclick="checkUrl()" class="check-btn">Check llms.txt</button>
            </div>
        </div>
        
        <div id="loading">Checking...</div>
        <div id="result"></div>
    </div>

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
                            <strong>Metadata:</strong><br><br>
                            <strong>Size:</strong> \${data.metadata.size} bytes<br>
                            <strong>Content-Type:</strong> \${data.metadata.contentType}<br>
                            <strong>Links found:</strong> \${data.metadata.linkCount}<br>
                            <strong>Valid links tested:</strong> \${data.metadata.validLinks}
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
