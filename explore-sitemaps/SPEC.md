# sitemap explorer lib: `explore-sitemap`

Goal:

- know the size of a website more cheaply
- know when pages change more effectively

SPEC

- input: domainName, config (only userAgent)
- output:
  - parsed robots.txt (use library: https://raw.githubusercontent.com/chrisakroyd/robots-txt-parser/refs/heads/master/README.md )
  - business logic on what is allowed to scrape
  - parsed sitemaps as JSON
  - parsed rss feed(s) as JSON
  - business logic to determine when to refresh
  - look for `llms.txt` and parse it/them: https://pastebin.contextarea.com/NyocieruJNGZP2S.md https://llmstxt.org/index.md

I need a cloudflare worker that can do this. give me a single file worker.ts that does it all. ensure just to crawl the indexes, not the actual pages that this links to . the worker can do max 1000 fetches so we can only do that.
