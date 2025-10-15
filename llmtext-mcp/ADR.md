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

Other common mistakes for llms.txt:

1. not served at https
2. slow: ensure it responds within 2 seconds, but preferably, much faster
3. not served at root. ensure your llms.txt is served at the root of your (sub)domain: yourwebsite.com/llms.txt
4. erroring out when presenting an accept header of text/plain or text/markdown. e.g. mintlify.ai currently does this
5. wrong content-type. ensure to respond with either text/plain or text/markdown.
6. the content is the full docs. the content must contain markdown links to docs, not all docs in one page
7. links return html. the links must lead to a text/markdown or text/plain acceptable response.
