Why

- the markdown browser always needs to crawl 1 level further than the visited url to not make it slow
- we also want to be able to crawl a subset of a website based on a filter (paths, or potentially agentically)
- we want the each page back asap.

Where to store?

- a DO has 10GB and would allow much faster filters on data of a specific domain
- an R2 has unlimited storage but the filtering on it isn't that fast, except if we use something like the new DuckDB WASM inside of a worker and store data in R2 in duckdb format. This would make the egress free making things much cheaper.

How to shard/index?

- by domain seems most logical since that's also how it's indexed using the URL
- another way is by user, but we want to share data between users!

Plan: Crawler with shared data between users

- Input: `crawl(url, { maxAge, staleWhileRevalidate, depth, path, async:"none"|"links"|"all", strategy: "links"|"path" }, { Authorization: PARALLEL_API_KEY, Accept:"application/json" | "text/event-stream" | "multipart/form-data" | "text/markdown" })`
- Connects with DomainDO and finds needed documents there, tries getting markdown directly through llms.txt convention, and finally tries with `/extract` as fallback.

  - with async is meant in what way to wait for the results. "none" means to wait until all is complete, "links" means to wait only for current page, while doing links in the background, and "all" means to directly respond when starting the process.
  - with "strategy" is meant: "links" means all hyperlinks need to be crawled with a given depth, while "path" means only all hyperlinks on the same path as the given path (except the last segment)
  - llms.txt convention: check for .md variant (append .md to url) or try accept text/markdown, text/plain)

- DO storage: `documents: {url,title,author,description,created_at,modified_at,icon,index_created_at,index_updated_at,index_fetched_at,etag,metadata,size,content,links,visits}[]`
- Output: the extracted pages as SSE Stream or multipart/form-data

This gives the ability to browse the internet while viewing what the AI system would see, but very cost effectively because of the shared index. Latency will be a single round-trip if indexed. Creating the SQLite index even when the website already offers markdown variants is useful because it allows doing a filter on its data very fast. It will be slowest when using extract.

endpoint GET /{hostname}/llms.txt

this endpoint should present all available documents from the site in llms.txt format. it should be with disclaimer that it's not certain to be complete and the owner of the website should distribute one themselves.

Context:

- llms.txt standard: https://llmstxt.org/index.md
- Cloudflare Durable objects: https://flaredream.com/system-ts.md
- extract api: https://docs.parallel.ai/api-reference/extract-beta/extract.md

Implement this crawl function as a Cloudflare worker.

Limitations:

- **speed**: There's just one DO per domain, making it slower in some parts of the world. Can later be solved if needed using DO replication (use multistub upon insertion! 6 locations, fast everywhere. great technical blogpost. ask Brave)
- **storage**: some websites are incredibly large so this may be painful. we could later add on-domain sharding for larger websites or create more aggressive clean-up, but this is out of scope for the purposes of this proof of concept.

Needed from parallel team:

- extract full content should be valid markdown!!! high priority.
- extract should return author,modified_at,description,icon,etag
