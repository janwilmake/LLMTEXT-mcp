# Discuss

- What do you think LLMTEXT does or SHOULD DO?
- Different Content Pieces
  - Generate `llms.txt` from your website => OSS library
  - LLMTEXT MCP
- Must be open source immediately LISENCE MIT
- X OAuth: Parallel Account?
- If sitemap wasn't found, generate one? https://docs.firecrawl.dev/features/map
- Get other things like branding colors, logos, screesnhot? https://assets.p0web.com

# TODO

## llms.txt generation guide

- ✅ Improve schema and cli further
- ✅ Create sitemap of everything together in the CLI
- Create a nice guide for making your website agent-friendly

## Use `extract-from-sitemap` for parallel.ai

- ✅ This should be a script in `package.json` that simply puts it all in a repo
- ✅ Since it's quite fast, can be added to precommit or predeploy
- Route accept: `text/markdown` requests should redirect to `.md` pages using next.js config
- Add `<link rel="alternate" type="text/markdown" href="docs.md" title="Docs" />` into metadata for each html page!
- Optional: use Sanity; Sanity uses [portable text](https://github.com/sanity-io/block-content-to-markdown) to retrieve the content. there is [a library](https://github.com/sanity-io/block-content-to-markdown) to turn this datastructure into markdown.

EOD: Have a PR for adding all these static files into `public` and the above changes!

## `developer-mcp.parallel.ai`

Rather than the X OAuthed MCP... Host a bare version of the MCP here, maybe?

## Bug report parallel.ai `/ai`

Bug reported from Tina: there also seems to be a bug where on the website clicking into machine mode isnt making it go into url/ai eg parallel.ai/ai, when its supposed to. strangely parallel.ai/ai works as a standalone page though.

# Sources

Create larger `llms.txt` hosted at https://parallel.ai/llms.txt with docs + sdks + blogs

- https://docs.parallel.ai/ (md already available)
- https://parallel.ai/ (use jina for each page)
- ❌ https://jobs.ashbyhq.com/parallel (use something like firecrawl)
- https://status.parallel.ai

Make a prompt that gets a summary of each SDK, make a PR for this in each SDK.

- https://github.com/parallel-web/parallel-sdk-python
- https://github.com/parallel-web/parallel-sdk-typescript

# Idea - LLMTEXT MCP ==> Hosted version of the library?

(Useful for easiest adoption)

- Optimize for speed (more parallelism, add description to extract endpoint)
- Allow for >500 urls (use DO and reset fetch counter during extraction using alarm)
- Host the result on `subdoman_domain_tld.markdownvariant.com` and bring MCP hosting together
- Determine other authored content, maybe include this as well?
