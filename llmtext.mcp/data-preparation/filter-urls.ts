#!/usr/bin/env bun
/// <reference lib="esnext" />

import { readFile, writeFile } from "fs/promises";
import { join } from "path";

interface ValidationResult {
  hostname: string;
  valid: boolean;
  warnings: string[];
  is404?: boolean;
  errors: string[];
  rank?: number;
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

function extractApexDomain(hostname: string): string {
  const parts = hostname.split(".");

  // Handle special cases like .co.uk, .com.au, etc.
  const twoPartTLDs = new Set([
    "co.uk",
    "com.au",
    "co.jp",
    "co.nz",
    "co.za",
    "com.br",
    "com.cn",
    "com.mx",
    "com.ar",
    "com.tr",
    "co.in",
    "co.id",
  ]);

  if (parts.length >= 3) {
    const lastTwo = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
    if (twoPartTLDs.has(lastTwo)) {
      // For two-part TLDs, take the last 3 parts
      return parts.slice(-3).join(".");
    }
  }

  // Default: take the last two parts
  if (parts.length >= 2) {
    return parts.slice(-2).join(".");
  }

  return hostname;
}

async function loadTrancoList(filePath: string): Promise<Map<string, number>> {
  try {
    console.log("Loading Tranco top-1m list...");
    const content = await readFile(filePath, "utf-8");
    const rankMap = new Map<string, number>();

    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const parts = trimmed.split(",");
      if (parts.length >= 2) {
        const rank = parseInt(parts[0].trim(), 10);
        const domain = parts[1].trim().toLowerCase();
        rankMap.set(domain, rank);
      }
    }

    console.log(`Loaded ${rankMap.size} domains from Tranco list`);
    return rankMap;
  } catch (error) {
    console.error("Error loading Tranco list:", error);
    console.log("Continuing without rank information...");
    return new Map();
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
        is404: response.status === 404,
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

function assignRanks(
  results: ValidationResult[],
  rankMap: Map<string, number>
): void {
  let rankedCount = 0;

  for (const result of results) {
    const apexDomain = extractApexDomain(result.hostname.toLowerCase());
    const rank = rankMap.get(apexDomain);
    if (rank !== undefined) {
      result.rank = rank;
      rankedCount++;
    }
  }

  console.log(`\nAssigned ranks to ${rankedCount} domains`);
}

async function main() {
  try {
    // Load Tranco list
    const rankMap = await loadTrancoList("top-1m.csv");

    // Read input file
    console.log("\nReading list.txt...");
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

    // Assign ranks to popular domains
    assignRanks(results, rankMap);

    // Sort results by rank (ranked first, then by hostname)
    results
      .filter((x) => !x.is404)
      .sort((a, b) => {
        // Put ranked items first, sorted by rank
        if (a.rank !== undefined && b.rank !== undefined) {
          return a.rank - b.rank;
        }
        if (a.rank !== undefined) return -1;
        if (b.rank !== undefined) return 1;
        // Then sort unranked by hostname
        return a.hostname.localeCompare(b.hostname);
      });

    // Write results
    const outputPath = join("..", "popular.json");
    console.log(`\nWriting results to ${outputPath}...`);
    await writeFile(outputPath, JSON.stringify(results, null, 2) + "\n");

    // Print summary
    const validCount = results.filter((r) => r.valid).length;
    const invalidCount = results.length - validCount;
    const rankedCount = results.filter((r) => r.rank !== undefined).length;

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
    console.log(
      `Ranked (in Tranco top-1m): ${rankedCount} (${(
        (rankedCount / results.length) *
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

    // Show top ranked examples
    const rankedExamples = results
      .filter((r) => r.rank !== undefined)
      .slice(0, 10);
    if (rankedExamples.length > 0) {
      console.log("\nTop 10 ranked domains:");
      rankedExamples.forEach((r) => {
        console.log(`  #${r.rank} - ${r.hostname}`);
      });
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

// Run the script
main();
