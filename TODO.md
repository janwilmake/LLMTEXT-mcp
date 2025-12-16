# extract-from-sitemap

- `llms-full.txt` should have a concatenation of the llms.txt and all linked to files underneath - Also generate `llms-full.txt`, and create `.genignore` files to ensure it's not included
- Remove newlines in descriptions to be according to spec.
- Ensure not to hit `/extract` urls count limitation or other errors. Log them.

# sitemap explorer lib: explore-sitemap

Goal:

- know the size of a website more cheaply
- know when pages change more effectively

Spec

- input: domain name
- output:
  - parsed robots.txt
  - business logic on what is allowed to scrape
  - parsed sitemaps as JSON
  - business logic to determine when to refresh
  - look for `llms.txt` and parse it/them

TODO: create separate `explore-sitemap` lib that works fully with the entire sitemap spec, including RSS and other things google and other crawlers would also support.

# More...

- See how we can prevent old files! aparently it's not good like this
- https://uithub.com/parallel-web/parallel-llms-txt?maxTokens=1000000 <-- this isn't correct lot of files are old.
- Setup auto-update of https://github.com/janwilmake/parallel-llms-txt using parallel secret and cloudflare deployment secret; Set to update and redeploy hourly while optimizing for cost. Important to have this as well, or our llms.txt will get outdated.
- Setup auto-prompt for https://github.com/parallel-web/parallel-sdk-typescript and https://github.com/parallel-web/parallel-sdk-python (and get prs merged for this)

After this, let's try and successfully make a large one work
