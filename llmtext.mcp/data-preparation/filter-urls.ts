#!/usr/bin/env bun

import { readFile, writeFile } from "fs/promises";
import { join } from "path";

interface ValidationResult {
  hostname: string;
  valid: boolean;
  warnings: string[];
  errors: string[];
}

interface ApiResponse {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: {
    linkCount: number;
    validPercentage: number;
    contentType: string;
  };
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "llms-txt-validator/1.0",
      },
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

function extractHostname(urlString: string): string {
  try {
    const url = new URL(urlString);
    return url.hostname;
  } catch {
    return urlString;
  }
}

async function validateUrl(url: string): Promise<ValidationResult> {
  const hostname = extractHostname(url);

  try {
    const encodedUrl = encodeURIComponent(url.trim());
    const checkUrl = `https://check.llmtext.com/check?url=${encodedUrl}&limit=50`;

    console.log(`Validating: ${hostname}`);

    const response = await fetchWithTimeout(checkUrl, 30000);

    if (!response.ok) {
      return {
        hostname,
        valid: false,
        warnings: [],
        errors: [`API returned ${response.status}: ${response.statusText}`],
      };
    }

    const data: ApiResponse = await response.json();

    return {
      hostname,
      valid: data.valid,
      warnings: data.warnings || [],
      errors: data.errors || [],
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`Error validating ${hostname}: ${errorMessage}`);

    return {
      hostname,
      valid: false,
      warnings: [],
      errors: [errorMessage],
    };
  }
}

async function processUrlsInQueue(
  urls: string[],
  concurrency: number = 6
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  const queue = [...urls];
  const inProgress = new Set<Promise<void>>();

  let completed = 0;
  const total = urls.length;

  while (queue.length > 0 || inProgress.size > 0) {
    // Fill up the queue to max concurrency
    while (inProgress.size < concurrency && queue.length > 0) {
      const url = queue.shift()!;

      const promise = validateUrl(url)
        .then((result) => {
          results.push(result);
          completed++;
          console.log(
            `✓ Progress: ${completed}/${total} - ${result.hostname} - ${
              result.valid ? "VALID" : "INVALID"
            }`
          );
        })
        .catch((error) => {
          console.error(`✗ Failed to process ${url}:`, error);
          completed++;
        })
        .finally(() => {
          inProgress.delete(promise);
        });

      inProgress.add(promise);
    }

    // Wait for at least one request to complete
    if (inProgress.size > 0) {
      await Promise.race(inProgress);
    }
  }

  return results;
}

async function main() {
  try {
    // Read input file
    console.log("Reading list.txt...");
    const content = await readFile("list.txt", "utf-8");
    const urls = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && line.startsWith("https://"));

    console.log(`Found ${urls.length} URLs to validate`);

    if (urls.length === 0) {
      console.error("No valid URLs found in list.txt");
      process.exit(1);
    }

    // Process URLs with concurrency limit
    console.log("\nStarting validation (max 6 concurrent requests)...\n");
    const results = await processUrlsInQueue(urls, 6);

    // Sort results by hostname for consistent output
    results.sort((a, b) => a.hostname.localeCompare(b.hostname));

    // Write results
    const outputPath = join("..", "popular.json");
    console.log(`\nWriting results to ${outputPath}...`);
    await writeFile(outputPath, JSON.stringify(results, null, 2) + "\n");

    // Print summary
    const validCount = results.filter((r) => r.valid).length;
    const invalidCount = results.length - validCount;

    console.log("\n" + "=".repeat(50));
    console.log("VALIDATION COMPLETE");
    console.log("=".repeat(50));
    console.log(`Total URLs processed: ${results.length}`);
    console.log(
      `Valid: ${validCount} (${((validCount / results.length) * 100).toFixed(
        1
      )}%)`
    );
    console.log(
      `Invalid: ${invalidCount} (${(
        (invalidCount / results.length) *
        100
      ).toFixed(1)}%)`
    );
    console.log("=".repeat(50));

    // Show some invalid examples
    const invalidExamples = results.filter((r) => !r.valid).slice(0, 5);
    if (invalidExamples.length > 0) {
      console.log("\nExample invalid entries:");
      invalidExamples.forEach((r) => {
        console.log(`\n  ${r.hostname}:`);
        if (r.errors.length > 0) {
          console.log(`    Errors: ${r.errors.join(", ")}`);
        }
        if (r.warnings.length > 0) {
          console.log(`    Warnings: ${r.warnings.join(", ")}`);
        }
      });
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

// Run the script
main();
