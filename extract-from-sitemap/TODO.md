# Use `extract-from-sitemap` for parallel.ai

- This should be a script in `package.json` that simply puts it all in `public`
- Since it's quite fast, can be added to precommit or predeploy
- Route accept: `text/markdown` requests should redirect to `.md` pages using next.js config
- Add `<link rel="alternate" type="text/markdown" href="docs.md" title="Docs" />` into metadata for each html page!

# Bug report parallel.ai /ai

Bug reported from Tina: there also seems to be a bug where on the website clicking into machine mode isnt making it go into url/ai eg parallel.ai/ai, when its supposed to. strangely parallel.ai/ai works as a standalone page though

# LLMTEXT MCP ==> Hosted version?

(Useful for easiest adoption)

- Optimize for speed (more parallelism, add description to extract endpoint)
- Allow for >500 urls (use DO and reset fetch counter during extraction using alarm)
- Host the result on subdoman_domain_tld.mdsite.com and bring MCP hosting together
- Determine other authored content, maybe include this as well?

# Discuss

- What do you think LLMTEXT does or SHOULD DO?
- Different Content Pieces
  - Generate `llms.txt` from your website => OSS library
  - LLMTEXT MCP
- Must be open source immediately LISENCE MIT
- X OAuth: Parallel Account?
- If sitemap wasn't found, generate one? https://docs.firecrawl.dev/features/map
