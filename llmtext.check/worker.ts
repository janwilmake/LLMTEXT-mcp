interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: {
    size: number;
    contentType: string;
    linkCount: number;
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
      response = await fetch(url.toString(), { signal: controller.signal });
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
      warnings.push(
        `Content too large: ${sizeInBytes} bytes (recommended max 100KB)`
      );
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
        });

        clearTimeout(linkTimeoutId);

        if (linkResponse.ok) {
          const linkContentType =
            linkResponse.headers.get("content-type") || "";
          const isValidLinkContentType = validContentTypes.some((type) =>
            linkContentType.toLowerCase().includes(type)
          );

          const text = await linkResponse.text();
          const isValidSize = text.length < 100 * 1024;
          if (isValidLinkContentType && isValidSize) {
            validLinks++;
          } else {
            warnings.push(
              `${link} is invalid: ${
                isValidSize
                  ? ""
                  : `Too large: ${text.length.toLocaleString()} characters`
              } ${
                isValidLinkContentType
                  ? ""
                  : `Invalid content type: ${linkContentType}`
              }`
            );
          }
        }
      } catch {
        // Silently continue - link validation failures are not critical
      }
    }

    if (linksToTest.length > 0 && validLinks === 0) {
      warnings.push(
        "None of the tested links were valid. Ensure they respond with markdown and are under 100kb in size each."
      );
    }

    metadata = {
      size: sizeInBytes,
      contentType: contentType,
      linkCount: links.length,
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

    // Redirect root to OpenAPI spec
    if (url.pathname === "/") {
      return Response.redirect("https://check.llmtext.com/openapi.json", 302);
    }

    // Serve OpenAPI specification
    if (url.pathname === "/openapi.json") {
      const openapi = {
        openapi: "3.0.0",
        info: {
          title: "llms.txt Validator API",
          version: "1.0.0",
          description:
            "Validate llms.txt files according to the llmstxt.org specification",
          contact: {
            name: "Parallel AI",
            url: "https://parallel.ai",
          },
        },
        servers: [
          {
            url: "https://check.llmtext.com",
            description: "Production server",
          },
        ],
        paths: {
          "/check": {
            get: {
              summary: "Validate an llms.txt file",
              description:
                "Validates an llms.txt file at the specified URL according to the llmstxt.org specification",
              parameters: [
                {
                  name: "url",
                  in: "query",
                  required: true,
                  description: "The URL of the llms.txt file to validate",
                  schema: {
                    type: "string",
                    format: "uri",
                    example: "https://example.com/llms.txt",
                  },
                },
              ],
              responses: {
                "200": {
                  description: "Validation result",
                  content: {
                    "application/json": {
                      schema: {
                        $ref: "#/components/schemas/ValidationResult",
                      },
                      examples: {
                        valid: {
                          summary: "Valid llms.txt file",
                          value: {
                            valid: true,
                            errors: [],
                            warnings: [],
                            metadata: {
                              size: 1024,
                              contentType: "text/plain",
                              linkCount: 5,
                            },
                          },
                        },
                        invalid: {
                          summary: "Invalid llms.txt file",
                          value: {
                            valid: false,
                            errors: [
                              "URL must use HTTPS protocol",
                              "Path must be exactly /llms.txt",
                            ],
                            warnings: [],
                          },
                        },
                      },
                    },
                  },
                },
                "400": {
                  description: "Bad request - missing or invalid URL parameter",
                  content: {
                    "application/json": {
                      schema: {
                        $ref: "#/components/schemas/ValidationResult",
                      },
                      example: {
                        valid: false,
                        errors: ["URL parameter is required"],
                        warnings: [],
                      },
                    },
                  },
                },
              },
            },
          },
        },
        components: {
          schemas: {
            ValidationResult: {
              type: "object",
              required: ["valid", "errors", "warnings"],
              properties: {
                valid: {
                  type: "boolean",
                  description: "Whether the llms.txt file is valid",
                },
                errors: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                  description: "List of validation errors",
                },
                warnings: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                  description: "List of validation warnings",
                },
                metadata: {
                  type: "object",
                  description: "Additional metadata about the file",
                  properties: {
                    size: {
                      type: "integer",
                      description: "Size of the file in bytes",
                    },
                    contentType: {
                      type: "string",
                      description: "Content-Type header value",
                    },
                    linkCount: {
                      type: "integer",
                      description: "Number of markdown links found",
                    },
                  },
                },
              },
            },
          },
        },
      };

      return new Response(JSON.stringify(openapi, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Validation endpoint
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
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }

      const result = await validateLlmsTxt(targetUrl);

      return new Response(JSON.stringify(result), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    return new Response("Not found", { status: 404 });
  },
};
