// @ts-check
/// <reference lib="esnext" />

import { parseLlmsTxt, type LlmsTxtFile } from "parse-llms-txt";

const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "llms.txt Validator API",
    version: "2.3.0",
    description:
      "Validate and analyze llms.txt files with deep link checking and comprehensive statistics. This API validates llms.txt files according to the specification at https://llmstxt.org, checking content types, link validity, and providing detailed token-based size metrics. Uses concurrent link checking with a maximum of 6 simultaneous requests. Automatically ignores links to llms-full.txt on the same hostname.",
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
        summary: "Validate and analyze an llms.txt file",
        description:
          "Validates an llms.txt file by checking its structure, content type, and all linked documents using a concurrent queue (max 6 simultaneous requests). Returns comprehensive statistics including token counts, link validity percentages, content type analysis, and detailed failure reasons for invalid links. The validator ensures all requirements of the llms.txt specification are met. Links to llms-full.txt on the same hostname are automatically ignored.",
        parameters: [
          {
            name: "url",
            in: "query",
            required: true,
            description:
              "Full URL of the llms.txt file to validate. Must use HTTPS protocol and end with /llms.txt path.",
            schema: {
              type: "string",
              format: "uri",
              example: "https://example.com/llms.txt",
            },
          },
          {
            name: "limit",
            in: "query",
            required: false,
            description:
              "Maximum number of links to randomly sample and check from the llms.txt file. Used to limit validation time for files with many links. Default: 50, Maximum: 500",
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 500,
              default: 50,
            },
          },
        ],
        responses: {
          "200": {
            description:
              "Validation completed successfully. Returns validation status, any errors or warnings, parsed content, detailed metadata about the file and its links, and failure reasons for invalid links.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ValidationResult",
                },
              },
            },
          },
          "400": {
            description:
              "Bad request - invalid URL parameter or limit value provided",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    valid: { type: "boolean", example: false },
                    errors: {
                      type: "array",
                      items: { type: "string" },
                      example: ["URL parameter is required"],
                    },
                    warnings: { type: "array", items: { type: "string" } },
                  },
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
        required: ["valid", "errors", "warnings", "metadata"],
        properties: {
          valid: {
            type: "boolean",
            description:
              "Overall validation status. False if any errors are present, including invalid content types, oversized documents, or insufficient valid link percentage.",
          },
          errors: {
            type: "array",
            items: { type: "string" },
            description:
              "List of validation errors that prevent the file from being considered valid. Includes issues like invalid URLs, wrong content types, oversized documents, and insufficient valid links.",
          },
          warnings: {
            type: "array",
            items: { type: "string" },
            description:
              "List of non-critical issues or suggestions for improvement, such as missing descriptions or details sections.",
          },
          parsed: {
            type: "object",
            nullable: true,
            description:
              "Parsed structure of the llms.txt file if parsing was successful. Null if parsing failed.",
          },
          metadata: {
            type: "object",
            required: [
              "sizeTokens",
              "contentType",
              "linkCount",
              "tokensInLlmsTxt",
              "checkedLinkCount",
              "ignoredLinkCount",
              "validLinkCount",
              "validPercentage",
              "textPlainOrMarkdownCount",
              "otherContentTypeCount",
              "sectionCount",
              "avgDescriptionLength",
              "hasDescription",
              "hasDetails",
              "linkResults",
            ],
            properties: {
              sizeTokens: {
                type: "integer",
                description:
                  "Size of the llms.txt file in tokens (calculated as bytes/5, rounded up)",
                example: 2048,
              },
              contentType: {
                type: "string",
                description:
                  "Content-Type header returned by the server for the llms.txt file",
                example: "text/plain; charset=utf-8",
              },
              linkCount: {
                type: "integer",
                description: "Total number of links found in the llms.txt file",
                example: 15,
              },
              tokensInLlmsTxt: {
                type: "integer",
                description:
                  "Estimated token count of the llms.txt file content (length/5, rounded)",
                example: 1024,
              },
              checkedLinkCount: {
                type: "integer",
                description:
                  "Number of links actually checked (may be less than total if limit parameter was used or links were ignored)",
                example: 15,
              },
              ignoredLinkCount: {
                type: "integer",
                description:
                  "Number of links ignored (llms-full.txt on same hostname)",
                example: 1,
              },
              validLinkCount: {
                type: "integer",
                description:
                  "Number of checked links that returned valid markdown/text content under 100k tokens",
                example: 14,
              },
              validPercentage: {
                type: "number",
                format: "float",
                description:
                  "Percentage of checked links that were valid. Must be 100% for overall validation to pass.",
                example: 93.33,
              },
              textPlainOrMarkdownCount: {
                type: "integer",
                description:
                  "Number of links that returned text/plain or text/markdown content types",
                example: 14,
              },
              otherContentTypeCount: {
                type: "integer",
                description:
                  "Number of links that returned other content types (considered invalid)",
                example: 1,
              },
              minLinkedDocTokens: {
                type: "integer",
                nullable: true,
                description:
                  "Smallest token count among all valid linked documents. Null if no valid links.",
                example: 512,
              },
              maxLinkedDocTokens: {
                type: "integer",
                nullable: true,
                description:
                  "Largest token count among all valid linked documents. Null if no valid links. Documents over 20000 tokens trigger an error.",
                example: 8192,
              },
              avgLinkedDocTokens: {
                type: "number",
                format: "float",
                nullable: true,
                description:
                  "Average token count across all valid linked documents. Null if no valid links.",
                example: 3456.5,
              },
              sectionCount: {
                type: "integer",
                description: "Number of sections in the llms.txt file",
                example: 3,
              },
              avgDescriptionLength: {
                type: "integer",
                description:
                  "Average length of file descriptions/notes in tokens across all sections",
                example: 128,
              },
              hasDescription: {
                type: "boolean",
                description:
                  "Whether the llms.txt file includes a top-level description. Warning issued if false.",
                example: true,
              },
              hasDetails: {
                type: "boolean",
                description:
                  "Whether the llms.txt file includes a details section. Warning issued if false.",
                example: true,
              },
              linkResults: {
                type: "array",
                description:
                  "Detailed results for each checked link including validity, token count, content type, and failure reason if invalid",
                items: {
                  type: "object",
                  properties: {
                    url: { type: "string" },
                    valid: { type: "boolean" },
                    tokens: { type: "integer" },
                    contentType: { type: "string" },
                    failReason: { type: "string" },
                    ignored: { type: "boolean" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  parsed?: LlmsTxtFile | null;
  // Detailed link results
  linkResults?: LinkCheckResult[];

  metadata: {
    // Basic info (in tokens)
    sizeTokens: number;
    contentType: string;
    linkCount: number;
    tokensInLlmsTxt: number;

    // Link stats
    checkedLinkCount: number;
    ignoredLinkCount: number;
    validLinkCount: number;
    validPercentage: number;
    textPlainOrMarkdownCount: number;
    otherContentTypeCount: number;

    // Size stats (in tokens)
    minLinkedDocTokens: number | null;
    maxLinkedDocTokens: number | null;
    avgLinkedDocTokens: number | null;

    // Structure stats
    sectionCount: number;
    avgDescriptionLength: number;
    hasDescription: boolean;
    hasDetails: boolean;
  };
}

interface LinkCheckResult {
  url: string;
  valid: boolean;
  tokens: number;
  contentType: string;
  failReason: string;
  ignored?: boolean;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 5);
}

function shouldIgnoreLink(linkUrl: string, baseHostname: string): boolean {
  try {
    const url = new URL(linkUrl);
    // Ignore if it's llms-full.txt on the same hostname
    return (
      url.hostname === baseHostname && url.pathname.endsWith("/llms-full.txt")
    );
  } catch {
    return false;
  }
}

async function checkLink(url: string): Promise<LinkCheckResult> {
  try {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return {
        url,
        valid: false,
        tokens: 0,
        contentType: "invalid",
        failReason: "Invalid URL protocol (must be http:// or https://)",
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "text/plain, text/markdown, */*" },
      });
      clearTimeout(timeoutId);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        return {
          url,
          valid: false,
          tokens: 0,
          contentType: "error",
          failReason: "Request timed out after 5 seconds",
        };
      }
      return {
        url,
        valid: false,
        tokens: 0,
        contentType: "error",
        failReason: `Network error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }

    if (!response.ok) {
      return {
        url,
        valid: false,
        tokens: 0,
        contentType: "error",
        failReason: `HTTP ${response.status} ${response.statusText}`,
      };
    }

    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();
    const tokens = estimateTokens(text);

    const isValidContentType = ["text/plain", "text/markdown"].some((type) =>
      contentType.toLowerCase().includes(type)
    );

    if (!isValidContentType) {
      return {
        url,
        valid: false,
        tokens,
        contentType,
        failReason: `Invalid content-type: ${contentType} (expected text/plain or text/markdown)`,
      };
    }

    if (tokens > 100000) {
      return {
        url,
        valid: false,
        tokens,
        contentType,
        failReason: `Document too large: ${tokens} tokens (max 100,000)`,
      };
    }

    return {
      url,
      valid: true,
      tokens,
      contentType,
      failReason: "",
    };
  } catch (error) {
    return {
      url,
      valid: false,
      tokens: 0,
      contentType: "error",
      failReason: `Unexpected error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

/**
 * Concurrent queue processor that maintains exactly N concurrent operations
 */
async function processConcurrentQueue<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];
  let index = 0;

  async function processNext(): Promise<void> {
    const currentIndex = index++;
    if (currentIndex >= items.length) return;

    const item = items[currentIndex];
    const result = await processor(item);
    results[currentIndex] = result;

    await processNext();
  }

  // Start initial concurrent workers
  for (let i = 0; i < Math.min(concurrency, items.length); i++) {
    executing.push(processNext());
  }

  await Promise.all(executing);
  return results;
}

function extractLinks(parsed: LlmsTxtFile, baseUrl: string): string[] {
  const links: string[] = [];
  for (const section of parsed.sections) {
    for (const file of section.files) {
      try {
        links.push(new URL(file.url, baseUrl).toString());
      } catch {
        links.push(file.url);
      }
    }
  }
  return links;
}

export async function validateLlmsTxt(
  baseUrl: string,
  limit: number = 50
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    let url: URL;
    try {
      url = new URL(baseUrl);
    } catch {
      errors.push("Invalid URL format");
      return { valid: false, errors, warnings, metadata: null! };
    }

    if (url.protocol !== "https:") errors.push("URL must use HTTPS");
    if (url.pathname !== "/llms.txt") errors.push("Path must be /llms.txt");
    if (errors.length > 0) {
      return { valid: false, errors, warnings, metadata: null! };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    let response: Response;
    try {
      response = await fetch(url.toString(), { signal: controller.signal });
      clearTimeout(timeoutId);
    } catch (error) {
      clearTimeout(timeoutId);
      errors.push(
        error instanceof Error && error.name === "AbortError"
          ? "Request timed out"
          : "Network error"
      );
      return { valid: false, errors, warnings, metadata: null! };
    }

    if (!response.ok) {
      errors.push(`HTTP ${response.status}`);
      return { valid: false, errors, warnings, metadata: null! };
    }

    const contentType = response.headers.get("content-type") || "";
    const isValidContentType = ["text/plain", "text/markdown"].some((type) =>
      contentType.toLowerCase().includes(type)
    );

    if (!isValidContentType) {
      errors.push(`Invalid content-type: ${contentType}`);
    }

    const content = await response.text();
    const tokensInLlmsTxt = estimateTokens(content);
    const sizeTokens = tokensInLlmsTxt;

    if (tokensInLlmsTxt > 20000) {
      warnings.push(`Content too large: ${tokensInLlmsTxt} tokens`);
    }

    let parsed: LlmsTxtFile | null = null;
    try {
      parsed = parseLlmsTxt(content);
    } catch (error) {
      errors.push("Failed to parse llms.txt");
      return { valid: false, errors, warnings, metadata: null! };
    }

    const allLinks = extractLinks(parsed, url.origin);
    if (allLinks.length === 0) {
      errors.push(
        "No links found, please ensure your llms.txt is parsed correctly."
      );
    }

    // Check for description and details
    if (!parsed.description) {
      warnings.push(
        "Consider adding a description section to explain what this llms.txt file contains"
      );
    }
    if (!parsed.details) {
      warnings.push(
        "Consider adding a details section with additional context about your content"
      );
    }

    // Filter out ignored links (llms-full.txt on same hostname)
    const baseHostname = url.hostname;
    const { toCheck: linksToCheck, ignored: ignoredLinks } = allLinks.reduce(
      (acc, link) => {
        if (shouldIgnoreLink(link, baseHostname)) {
          acc.ignored.push(link);
        } else {
          acc.toCheck.push(link);
        }
        return acc;
      },
      { toCheck: [] as string[], ignored: [] as string[] }
    );

    // Randomly sample links from the non-ignored ones
    const sampledLinks = linksToCheck
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(limit, linksToCheck.length));

    // Check all sampled links with concurrent queue (max 6 at a time)
    const linkResults = await processConcurrentQueue(
      sampledLinks,
      checkLink,
      6
    );

    // Add ignored links to results
    const ignoredResults: LinkCheckResult[] = ignoredLinks.map((link) => ({
      url: link,
      valid: true,
      tokens: 0,
      contentType: "ignored",
      failReason: "",
      ignored: true,
    }));

    const allLinkResults = [...linkResults, ...ignoredResults];

    const validResults = linkResults.filter((r) => r.valid);
    const tokenCounts = validResults.map((r) => r.tokens).filter((t) => t > 0);

    const textPlainOrMarkdownCount = linkResults.filter((r) =>
      ["text/plain", "text/markdown"].some((type) =>
        r.contentType.toLowerCase().includes(type)
      )
    ).length;

    const otherContentTypeCount = linkResults.length - textPlainOrMarkdownCount;

    // Check for oversized documents
    const oversizedLinks = linkResults.filter((r) => r.tokens > 100000);
    if (oversizedLinks.length > 0) {
      errors.push(
        `The following linked documents exceed 100000 tokens: ${oversizedLinks
          .map((l) => `${l.url} (${l.tokens} tokens)`)
          .join(", ")}`
      );
    }

    // Check valid percentage (only for non-ignored links)
    const validPercentage =
      linkResults.length > 0
        ? (validResults.length / linkResults.length) * 100
        : 0;

    if (validPercentage < 100 && linkResults.length > 0) {
      const invalidLinks = linkResults
        .filter((r) => !r.valid)
        .map((r) => `${r.url} (${r.failReason})`);
      errors.push(
        `From ${linkResults.length} checked links, only ${
          validResults.length
        } returned valid (${validPercentage.toFixed(
          1
        )}%) markdown/text. Invalid links: ${invalidLinks.join(", ")}`
      );
    }

    // Calculate description lengths
    const descriptionLengths = parsed.sections.flatMap((section) =>
      section.files.map((file) => estimateTokens(file.notes || ""))
    );

    const avgDescriptionLength =
      descriptionLengths.length > 0
        ? Math.round(
            descriptionLengths.reduce((a, b) => a + b, 0) /
              descriptionLengths.length
          )
        : 0;

    const metadata = {
      sizeTokens,
      contentType,
      linkCount: allLinks.length,
      tokensInLlmsTxt,

      checkedLinkCount: linkResults.length,
      ignoredLinkCount: ignoredLinks.length,
      validLinkCount: validResults.length,
      validPercentage: Math.round(validPercentage * 100) / 100,
      textPlainOrMarkdownCount,
      otherContentTypeCount,

      minLinkedDocTokens:
        tokenCounts.length > 0 ? Math.min(...tokenCounts) : null,
      maxLinkedDocTokens:
        tokenCounts.length > 0 ? Math.max(...tokenCounts) : null,
      avgLinkedDocTokens:
        tokenCounts.length > 0
          ? Math.round(
              tokenCounts.reduce((a, b) => a + b, 0) / tokenCounts.length
            )
          : null,

      sectionCount: parsed.sections.length,
      avgDescriptionLength,
      hasDescription: !!parsed.description,
      hasDetails: !!parsed.details,
    };

    if (validResults.length === 0 && linkResults.length > 0) {
      warnings.push("None of the checked links were valid");
    }

    if (ignoredLinks.length > 0) {
      warnings.push(
        `Ignored ${
          ignoredLinks.length
        } link(s) to llms-full.txt on the same hostname: ${ignoredLinks.join(
          ", "
        )}`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      parsed,
      linkResults: allLinkResults,
      metadata,
    };
  } catch (error) {
    errors.push(
      `Unexpected error: ${error instanceof Error ? error.message : "Unknown"}`
    );
    return { valid: false, errors, warnings, metadata: null! };
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response(null, {
        status: 302,
        headers: { Location: "/openapi.json" },
      });
    }

    if (url.pathname === "/openapi.json") {
      return new Response(JSON.stringify(openApiSpec, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    if (url.pathname === "/check") {
      const targetUrl = url.searchParams.get("url");
      const limitParam = url.searchParams.get("limit");

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

      let limit = 50;
      if (limitParam) {
        const parsed = parseInt(limitParam, 10);
        if (isNaN(parsed) || parsed < 1) {
          return new Response(
            JSON.stringify({
              valid: false,
              errors: ["limit must be a positive number"],
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
        limit = Math.min(parsed, 500);
      }

      const result = await validateLlmsTxt(targetUrl, limit);

      return new Response(JSON.stringify(result, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    return new Response("Not found", { status: 404 });
  },
};
