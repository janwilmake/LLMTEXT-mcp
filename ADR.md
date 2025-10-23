https://docs.google.com/document/d/1_TJrEVH5TLc2nrTsw6XDZ-npU57vRyyHDQG7ivhimu4/edit?tab=t.0#heading=h.84z3i7289xus

https://www.notion.so/LLM-TXT-Launch-28f58ffbf0e180e79990d259d222cca2

# X POST

I'm super excited to announce LLMTEXT, a new tool I made with the support of @p0. LLMTEXT is an Open Source project supporting the llms.txt standard with an ecosystem of tools and libraries to help web publishers create a more agent-friendly interface, in turn improving the developer experience.

LLMTEXT is launching with the following three OSS tools:

- **llms.txt MCP**: making llms.txt actually useful by turning any website that has an llms.txt into a dedicated MCP server.
- **llms.txt checker**: validate your llms.txt to ensure it's valid and follows best practices
- **llms.txt generator**: A library to generate a single llms.txt with accompanied markdown from multiple sources.

## Discuss

- Different Content Pieces
  - Generate `llms.txt` from your website => OSS library
  - Create a nice guide for making your website agent-friendly
  - LLMTEXT MCP
- X OAuth: Parallel Account?

# What are goals for this project, what is the value, what are non-goals?

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

# Why separate repo & hostname is best practice?

After considering this for a while, it seems to me that a separate repo is better practice than putting it on the root. Why?

- we don't want only the main domain, we want all subdomains and other locations where important context can be found.
- it reduces complication because it can be a different host, makign it easier to set up github actions without getting in a weird loop
- can make OSS which also allows people to explore the markdown on github
- can more easily deploy MCP server besides it (subdomain)
- we can just add proper info in rel alternate and redirect from 'accept' header

# Why X OAuth

- Track daily active developers and active developers over time for the web publisher
- Social profile has ability to be enriched using Parallel for deeper understanding
- Get good leadlist of companies where devs are using the APIs
- Understand which influential peole are using our products for strategic marketing
