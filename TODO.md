# TODO

High level

1. Our own llms.txt is perfect and auto-updates
2. Libraries works and properly guides people to do the same
3. MCP serves all work as intended.

Later:

- Hosted version of llms.txt generation, user-budget + cache
- See [backlog](BACKLOG.md)

## Parallel PR

- ✅ intercept `accept:text/markdown` requests
- ✅ Route accept: `text/markdown` requests should rewrite to llm.parallel.ai
- ✅ `.md` suffix should be catched as well if `rewriteTo` is available
- ✅ `llms.txt, llms-full.txt, /mcp` should rewrite to llm.parallel.ai (if available)
- ✅ Put all .md files into https://github.com/janwilmake/parallel-llmtext using build script.
- ✅ Every path on parallel.ai has `.md` available (ensure they are all in sitemap, no 404s are in sitemap, and we re-generate from that new sitemap)
- ✅ Add `<link rel="alternate" type="text/markdown" href="{path}.md" title="Docs" />` into metadata for each html page!

## Website

- ✅ Adhere to figma design
- ✅ Ensure mcp.parallel.ai serves data as JSON at `index.json`, including top 10 users leaderboard
- ✅ link from hostname to raw `llms.txt`
- ✅ Fetch that and overwrite `window.data` in the HTML using node-script pre-deploy
- Document check API and add llmstxt-check-tool.

## MCP

- Ensure relative links are also correctly fetched from the right hostname. Ensure hostname is part of description clearly.
- Give people an option to opt-out of the social element before logging in with X (for simplicity, login with X remains required). Host this x-login-provider wrapper at `login.llmtext.com`

## Finish `extract-from-sitemap`

Create very good README.md that uses https://github.com/janwilmake/parallel-llmtext as example and explains everything you need to do to serve a good `llms.txt` in step-by-step plan.

## Draft Blogpost/learnings

- Why this a fair alternative to context7
- Reasoning over a table of contents > vector search?
- Every website needs an llms.txt, not just docs sites!
- Parallel.ai llms.txt combines main website + docs + socials

## Auto-update

Setup auto-update of https://github.com/janwilmake/parallel-llmtext using a secret; Set to update hourly while optimizing for cost. Important to have this as well!

# Launch

- Open issue in https://github.com/AnswerDotAI/llms-txt
- Reach out to https://x.com/jeremyphoward (somehow)
- On parallel cookbook, remove old stuff, add this one.
- On parallel docs, link to this (If X OAuth is OK)
- Launch it on MCP directories in a way that context7/gitmcp did it too
- Use it for https://docs.parallel.ai/llms.txt and make demo
- X Launch post
