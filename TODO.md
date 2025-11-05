# extract-from-sitemap

- Also generate `llms-full.txt`, and create `.genignore` files to ensure it's not included
- See how we can prevent old files! aparently it's not good like this
- https://uithub.com/parallel-web/parallel-llms-txt?maxTokens=1000000 <-- this isn't correct lot of files are old.
- Fix it so it works for recursive sitemaps: https://developers.cloudflare.com/sitemap.xml
- Remove newlines in descriptions to be according to spec.
- Ensure not to hit `/extract` urls count limitation or other errors. Log them.
- Setup auto-update of https://github.com/janwilmake/parallel-llmtext using parallel secret and cloudflare deployment secret; Set to update and redeploy hourly while optimizing for cost. Important to have this as well, or our llms.txt will get outdated.
- Setup auto-prompt for https://github.com/parallel-web/parallel-sdk-typescript and https://github.com/parallel-web/parallel-sdk-python (and get prs merged for this)

After this, let's try and successfully make a large one work
