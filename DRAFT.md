# Introducing LLMTEXT.com

We're excited to announce a new project we're supporting from Jan Wilmake, a major contributor to our developer experience at Parallel. Jan has led many of our projects related to MCP as well as the Parallel Cookbook.

LLMTEXT is an Open Source project supporting the llms.txt standard with an ecosystem of tools and libraries to help web publishers create a more agent-friendly interface, in turn improving the developer experience.

## Why LLMTEXT

> [!WARNING]
>
> To be refined

- AI is becoming the new user of the web. We expect AI traffic to grow 1000x in the coming decade.
- Web-scraping companies and AI browsers have seen a surge in usage while human use of the web is shrinking.
- This is very inefficient causing higher latency and cost.
- Web publishers could directly make llm-readable content available. we're still very early and very few are doing so.
- `llms.txt` is a new standard providing navigation of websites in a llm-friendly format, addressing this issue
- It has been widely adopted for documentation but not adopted yet for most websites. Also not without problems. Tons of llms.txt files have issues.

### Ecosystem of AI context gathering tools

> [!WARNING]
>
> To be refined

- uithub.com
- context7
- gitmcp.io
- How do we want to differentiate this from similar projects like? https://deepwiki.com/
- https://agents.md

Why does llmtext-mcp deserve a place? because we're just at the beginning of exploring different ways of context engineering, vector search is not the only way.

Reasoning over a table of contents > vector search?

## For who is this?

The three LLMTEXT tools we're releasing today serve two purposes, on the one hand, the MCP helps developers use projects without hallucination by getting a dedicated MCP for every library or API they use that supports llms.txt. On the other hand, the **llms.txt checker** and **llms.txt generator** aids websites to serve their users the best possible llms.txt. Let's dive into each tool:

### 01: Create an llms.txt

Most websites aren't adapted to the AI internet yet and just serve HTML content intended for humans, and most CMS systems don't support the creation of a markdown version yet. llms.txt generators found on the internet just create the llms.txt file but most often don't refer to plain text or markdown variant of the pages. The [extract-from-sitemap](https://github.com/janwilmake/llmtext-mcp/tree) tool doesn't just generate an llms.txt from multiple sources, it also scrapes all needed pages and turns them into markdown, powered by the new [Parallel Extract API](https://docs.parallel.ai/api-reference/search-and-extract-api-beta/extract). We used this library to create [our own llms.txt](https://parallel.ai/llms.txt) which is also available through [this repo](https://github.com/janwilmake/parallel-llmtext) and [installable as MCP](https://installthismcp.com/parallel-llmtext-mcp?url=https://mcp.llmtext.com/parallel.ai/mcp).

### 02: Check any llms.txt validity

When building the llms.txt MCP and trying it out on [some of the available MCPs](https://github.com/thedaviddias/llms-txt-hub) many of them turned out to be incorrect according to the [llms.txt prescribed format](https://llmstxt.org) for various reasons.

The goal of your `llms.txt` should be to give LLMs the best possible overview: a table of contents to determine where to look for the right information. Or as [@travers00 puts it](https://x.com/travers00/status/1975947045497344162), the goal is to retrieve the tokens agents need to answer or make the next best decision in a loop. This means that you should have clear distinct titles and descriptions of pages, the individual results of pages shouldn't be too long.

For example, in [this llms.txt from supabase](https://supabase.com/llms.txt), the first file has 800k tokens. The [cloudflare llms.txt](https://developers.cloudflare.com/llms.txt) is 36k tokens which is quite long for most models and quickly adds to the context window starting to reduce the output quality. To make token-usage efficient when wading through context, it's best if the `llms.txt` itself is not bigger than the pages being linked to. If it is, it becomes a significant addition to the context window every time you may want to retrieve a piece of information.

As a fist rule, keep it under 10k:

- `llms.txt` must be under 10k tokens
- The pages linked to must be under 10k tokens

Other than that we found the following common mistakes in llms.txt files:

1. **not served at root** - ensure your llms.txt is served at the root of your (sub)domain: yourwebsite.com/llms.txt
2. erroring out when presenting an accept header of text/plain or text/markdown. e.g. [mintlify](https://www.mintlify.com/docs/ai/llmstxt) currently does this.
3. **wrong content-type** - ensure to respond with either text/plain or text/markdown.
4. **the content is the full docs** - the content must contain markdown links to docs, not all docs in one page. For this you can make available `/llms-full.txt`
5. **links return html** - the links must lead to a text/markdown or text/plain acceptable response. This is probably the most common mistakes in llms.txt files today from large companies.

Lots of llms.txt are low quality. The llms.txt checking tool aims to improve this.

### 03: Make any llms.txt into MCP

> [!WARNING]
>
> To be refined

Once you have a high quality `llms.txt` hosted, LLMTEXT offers a dedicated MCP server for it.

## Future of LLMTEXT

This is just the beginning... We hope the llms.txt standard will thrive and evolve into a much more valuable standard with many more use-cases. We've already started further improving the tooling and adding more utilities, pushing web accessibility for agents.

## Develop spotlight: Jan Wilmake

> [!WARNING]
>
> To be refined

- Your background

- Related Projects: https://github.com/janwilmake/openapisearch, https://github.com/janwilmake/openapi-mcp-server, https://uithub.com
