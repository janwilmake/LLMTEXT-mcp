# parse-llms-txt

A JavaScript parser for [llms.txt](https://llmstxt.org) files that converts the structured markdown format into JSON.

## What is llms.txt?

The `llms.txt` specification provides a standardized way for websites to offer LLM-friendly content. It's a markdown file located at `/llms.txt` that contains:

- **Project title** (H1 header - required)
- **Description** (blockquote - optional)
- **Details** (content before first H2 - optional)
- **Sections** (H2 headers with file lists - optional)

Learn more at [llmstxt.org](https://llmstxt.org).

## Installation

```bash
npm install parse-llms-txt
```

## Usage

### As a Module

```js
import { parseLlmsTxt } from "parse-llms-txt";

// Parse from string
const markdown = `
# My Project

> A brief description of my project

Some additional details here.

## Documentation

- [API Reference](https://example.com/api.md): Complete API documentation
- [Quick Start](https://example.com/start.md): Getting started guide

## Examples

- [Basic Example](https://example.com/basic.md)
`;

const parsed = parseLlmsTxt(markdown);
console.log(parsed);
```

### From URL

```js
import { parseLlmsTxt } from "parse-llms-txt";

const response = await fetch("https://docs.parallel.ai/llms.txt");
const content = await response.text();
const parsed = parseLlmsTxt(content);

console.log(`Project: ${parsed.title}`);
console.log(`Sections: ${parsed.sections.length}`);
```

### Command Line Interface

```bash
# Parse from file
npx parse-llms-txt llms.txt

# Parse from URL
npx parse-llms-txt https://docs.parallel.ai/llms.txt

# With Bun
bun run parse-llms-txt https://docs.parallel.ai/llms.txt
```

## Output Format

The parser returns a JSON object with this structure:

```js
{
  title: string,           // Project name from H1 (required)
  description?: string,    // Description from blockquote (optional)
  details?: string,        // Content before first H2 (optional)
  sections: [              // H2 sections with file lists
    {
      name: string,        // Section name
      files: [             // File entries
        {
          name: string,    // Link text
          url: string,     // Link URL
          notes?: string   // Optional notes after ":"
        }
      ]
    }
  ]
}
```

## Example Output

Given this llms.txt:

```markdown
# FastHTML

> FastHTML is a python library for creating server-rendered hypermedia applications.

Important notes about compatibility and usage.

## Documentation

- [Quick Start](https://fastht.ml/docs/quickstart.html.md): A brief overview
- [HTMX Reference](https://github.com/bigskysoftware/htmx/blob/master/www/content/reference.md): HTMX documentation

## Optional

- [Full Documentation](https://fastht.ml/docs/full.md): Complete documentation
```

The parser produces:

```json
{
  "title": "FastHTML",
  "description": "FastHTML is a python library for creating server-rendered hypermedia applications.",
  "details": "Important notes about compatibility and usage.",
  "sections": [
    {
      "name": "Documentation",
      "files": [
        {
          "name": "Quick Start",
          "url": "https://fastht.ml/docs/quickstart.html.md",
          "notes": "A brief overview"
        },
        {
          "name": "HTMX Reference",
          "url": "https://github.com/bigskysoftware/htmx/blob/master/www/content/reference.md",
          "notes": "HTMX documentation"
        }
      ]
    },
    {
      "name": "Optional",
      "files": [
        {
          "name": "Full Documentation",
          "url": "https://fastht.ml/docs/full.md",
          "notes": "Complete documentation"
        }
      ]
    }
  ]
}
```

## API Reference

### `parseLlmsTxt(markdown: string): LlmsTxtFile`

Parses an llms.txt markdown string into a structured JSON object.

**Parameters:**

- `markdown` (string): Raw markdown content of the llms.txt file

**Returns:** `LlmsTxtFile` object with parsed components

### `parseListLine(line: string): FileEntry | null`

Parses a single markdown list line to extract file information.

**Parameters:**

- `line` (string): Markdown list line starting with "- "

**Returns:** `FileEntry` object or `null` if parsing fails

## Type Definitions

```js
/**
 * @typedef {Object} FileEntry
 * @property {string} name - Display name of the file/link
 * @property {string} url - URL to the resource
 * @property {string} [notes] - Optional notes describing the file
 */

/**
 * @typedef {Object} Section
 * @property {string} name - Section name from H2 header
 * @property {FileEntry[]} files - Array of file entries
 */

/**
 * @typedef {Object} LlmsTxtFile
 * @property {string} title - Project title from H1 header
 * @property {string} [description] - Optional description from blockquote
 * @property {string} [details] - Optional details before first H2
 * @property {Section[]} sections - Array of sections
 */
```

## Runtime Support

This package works with:

- **Node.js** (18+ recommended)
- **Bun** (latest)
- **Browsers** (ES2020+)

## Examples in the Wild

Try parsing these real llms.txt files:

```bash
# Parallel AI Platform
npx parse-llms-txt https://docs.parallel.ai/llms.txt

# FastHTML Documentation
npx parse-llms-txt https://www.fastht.ml/docs/llms.txt

# Answer.AI projects
npx parse-llms-txt https://fastcore.fast.ai/llms.txt
```

## Contributing

Found a bug or want to contribute? Visit our [GitHub repository](https://github.com/janwilmake/parse-llms-txt).

## License

MIT

## Related

- [llmstxt.org](https://llmstxt.org) - Official llms.txt specification
- [llms_txt2ctx](https://llmstxt.org/intro.html#cli) - CLI tool for expanding llms.txt files
- [Directory of llms.txt files](https://llmstxt.site/) - Browse available llms.txt files
