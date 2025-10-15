# Context

- https://zipobject.com/openapi.json
- https://reader.llmtext.com/openapi.json
- https://browser.llmtext.com/openapi.json

# Get LLM Text for any URL

This proxy redirects to the API that has the best possible result for scraping a given URL. It chooses between zip contents, reader results, or browser results.

POC:

- ✅ Get request pathname (url) and accept header/query
- ✅ Try zipobject first with accept header `text/markdown` (works for zip files or things like github)
- ✅ If not available, use `reader.llmtext.com/md/URL`
- ✅ If not available, return 404
- ✅ Finally, store result URL (with age) in KV, so it can be quickly redirected.
