## Reduce size of tool description

We decided to use an additional tool for retrieving `llms.txt` first to not pollute context too much for people who don't turn off their MCPs. Slightly increases latency but greatly improves ux incase people don't turn these things off.

## Discuss

- Different Content Pieces
  - Generate `llms.txt` from your website => OSS library
  - Create a nice guide for making your website agent-friendly
  - LLMTEXT MCP
- X OAuth: Parallel Account?

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
