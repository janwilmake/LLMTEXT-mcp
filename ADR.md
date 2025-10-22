# Discuss

- Different Content Pieces
  - Generate `llms.txt` from your website => OSS library
  - Create a nice guide for making your website agent-friendly
  - LLMTEXT MCP
- X OAuth: Parallel Account?

# What are goals for this project, what is the value, what are non-goals?

https://www.notion.so/LLM-TXT-Launch-28f58ffbf0e180e79990d259d222cca2

**Why we built this**

- Brand awareness Parallel
- Viral potential
- Establish Developer Trust
- Facilitate the creation of an independent project aiming to be taken over by OSS community

**What we think the value is: A free tool that is "public good infrastructure" for the internet for AIs**

- **For web-publishers**: to make their content more accessible to AI agents
- **For end-users**: to easily talk with an AI version of every website
- **For developers (and their agents)**: to more easily build new products with context of websites, alleviating barrier of scraping

**Non goals**

- Extra revenue for parallel

**How to get this**

- Make it 'Sponsored/powered/backed by Parallel', not 'by Parallel'
- Owned by Jan, sponsored by Parallel credits, backed by Parallel team

# Learnings

# Why X OAuth

- Track daily active developers and active developers over time for the web publisher
- Social profile has ability to be enriched using Parallel for deeper understanding
- Get good leadlist of companies where devs are using the APIs
- Understand which influential peole are using our products for strategic marketing

# What Makes A Good `llms.txt`?

The goal of your `llms.txt` should be to give LLMs the best possible overview: a table of contents to determine where to look for the right information. Or as [@travers00 puts it](https://x.com/travers00/status/1975947045497344162), the goal is to retrieve the tokens agents need to answer or make the next best decision in a loop. This means that you should have clear distinct titles and descriptions of pages, the individual results of pages shouldn't be too long (for example, this llms.txt file is terrible: https://supabase.com/llms.txt, the first link has 800k tokens), and the llms.txt itself should also not be too long (for example, the cloudflare llms.txt is 36k tokens: https://developers.cloudflare.com/llms.txt). To make token-usage efficient when wading through context, it's best if the `llms.txt` itself is not bigger than the pages being linked to. If it is, it becomes a significant addition to the context window every time you may want to retrieve a piece of information.

As a fist rule, keep it under 10k:

- `llms.txt` must be under 10k tokens
- The pages linked to must be under 10k tokens

Other than that I've found the following common mistakes in llms.txt files:

1. **not served at root**. ensure your llms.txt is served at the root of your (sub)domain: yourwebsite.com/llms.txt
2. erroring out when presenting an accept header of text/plain or text/markdown. e.g. mintlify.ai currently does this
3. **wrong content-type**. ensure to respond with either text/plain or text/markdown.
4. **the content is the full docs**. the content must contain markdown links to docs, not all docs in one page
5. **links return html**. the links must lead to a text/markdown or text/plain acceptable response.

Lots of llms.txt are low quality and the guidelines from the standard are ambiguous.

# No description from `/extract` api

extract endpont nicely returns title and published date which is truly awesome, but it doesn't get the description, causing me to need to do 2 extra api calls PER PAGE.

# Why separate repo & hostname is best practice?

After considering this for a while, it seems to me that a separate repo is better practice than putting it on the root. Why?

- we don't want only the main domain, we want all subdomains and other locations where important context can be found.
- it reduces complication because it can be a different host, makign it easier to set up github actions without getting in a weird loop
- can make OSS which also allows people to explore the markdown on github
- can more easily deploy MCP server besides it (subdomain)
- we can just add proper info in rel alternate and redirect from 'accept' header
