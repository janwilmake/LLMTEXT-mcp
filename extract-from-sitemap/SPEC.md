# Sitemap Scraper Specification

## Core Flow

1. Pass a hostname
2. Find sitemap for hostname
3. For each sitemap URL:
   - Fetch with `accept: text/html` and `accept: text/markdown` in parallel
   - Extract title and og:description from HTML
   - Use parallel extract API (env API key) for URLs not responding with text/markdown
4. Return structured object with all content

## Requirements

- Initial sitemap page fetching: parallel text/markdown and text/html requests for speed
- Per-page returns: `extracted: boolean`, `status: number` (HTML response status)
- Key format: path + '.md' appended
- Token calculation: `Math.round(content.length/5)`
- Generate `/llms.txt` using llms.txt format from titles, descriptions, content
  - Top-level description: homepage title + description
  - Per-item prefix: `({tokens} tokens)` before description
- Top-level keys: `totalTokens`, `totalPages`, `errors`, `processingTimeMs`, `extractApiCallCount`, `fetchCount`

## Response Structure

```javascript
{
  files: {
    [key: string]: {
      error?: string,
      content: string,
      title: string,
      description: string,
      extracted: boolean,
      status: number,
      tokens: number
    }
  },
  totalTokens: number,
  totalPages: number,
  errors: number,
  processingTimeMs: number,
  extractApiCallCount: number,
  fetchCount: number
}
```

# Create `extractFromSitemap(origin,forceExtract)` functionality

- Look at meta rel alternate for text markdown variant, use that if available - `<link rel="alternate" type="text/markdown" href="docs.md" title="Docs" />`
- Should return links sorted by path
- Maybe: remove duplicate parts from title and/or description somehow

# CLI `extract-from-sitemap`

- `npx extract-from-sitemap`
- Configure `llmtext.json`. Required. Should allow setting `{ outDir:string, origins:string[],customUrls:{title:string,description:string,url:string}[], keepOriginalUrls:boolean, forceExtract: boolean }`
- keepOriginal means we don't copy over the remote urls into our fs
- forceExtract means we don't look for md variant but use extract endpoint directly
- Should use Parallel OAuth if no `.env` is found or no env is passed.
- Writes files to outdir, removes old files that weren't overwritten using old manifest `llmtext-manifest.json`, write manifest

## Sources

- https://llmstxt.org/index.md
- @extract-api.md
- https://flaredream.com/system-ts.md
