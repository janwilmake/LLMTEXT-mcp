# Issues

- https://github.com/janwilmake/LLMTEXT-mcp/issues/1: not working in cursor; see why it keeps loading tools!
- https://github.com/janwilmake/LLMTEXT-mcp/issues/2: path error should not misvalidate. allow llms.txt at any path

# extract-from-sitemap

- `extract-from-sitemap`: Add support for RSS/Atom
- `llms-full.txt` should have a concatenation of the llms.txt and all linked to files underneath - Also generate `llms-full.txt`, and create `.genignore` files to ensure it's not included
- Remove newlines in descriptions to be according to spec.
- Ensure not to hit `/extract` urls count limitation or other errors. Log them.

# More...

- See how we can prevent old files! aparently it's not good like this
- https://uithub.com/parallel-web/parallel-llms-txt?maxTokens=1000000: This isn't correct lot of files are old.
- Setup auto-update of https://github.com/janwilmake/parallel-llms-txt using parallel secret and cloudflare deployment secret; Set to update and redeploy hourly while optimizing for cost. Important to have this as well, or our llms.txt will get outdated.
- Setup auto-prompt for https://github.com/parallel-web/parallel-sdk-typescript and https://github.com/parallel-web/parallel-sdk-python (and get prs merged for this)

After this, let's try and successfully make a large one work
