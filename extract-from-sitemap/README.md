This repo allows you to create a static markdown bundle based on one or multiple sources. The sources must either have a functional and complete sitemap, or should specify custom urls to be extracted.

## Step by Step Guide

1. Create a `llmtext.json` file in the root of your project. This is where you define your sources to be extracted from. For an example combining multiple sources, see [this example](https://github.com/janwilmake/parallel-llmtext/blob/main/llmtext.json).
2. Run `npx extract-from-sitemap` (or add it to your `package.json` scripts, [like this](https://github.com/janwilmake/parallel-llmtext/blob/main/package.json))
3. Set up CI/CD in your repo to automatically update your extracted static files as often as needed. See [CI/CD Setup](#cicd-setup) below.
4. Use an agent-rewriter such as [next-agent-rewriter](../next-agent-rewriter) to rewrite agent requests to the appropriate static markdown files. In addition, it's best practice to add a link in your html to show the markdown variant is available, like this: `<link rel="alternate" type="text/markdown" href="{path}.md" title="Docs" />`

## CI/CD Setup

### GitHub Actions

1. Get your Parallel API key from [platform.parallel.ai](https://platform.parallel.ai)

2. Add it as a repository secret:

   - Go to your repository → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `PARALLEL_API_KEY`
   - Value: Your API key from step 1

3. Create `.github/workflows/extract-docs.yml`:

```yaml
name: Extract Documentation

on:
  schedule:
    - cron: "0 0 * * *" # Daily at midnight UTC
  workflow_dispatch: # Allow manual trigger

jobs:
  extract:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Extract documentation
        env:
          PARALLEL_API_KEY: ${{ secrets.PARALLEL_API_KEY }}
        run: |
          npm install -g extract-from-sitemap
          npx extract-from-sitemap

      - name: Commit changes
        run: |
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git config user.name "github-actions[bot]"
          git add .
          git diff --quiet && git diff --staged --quiet || \
            (git commit -m "Update docs [skip ci]" && git push)
```

### GitLab CI

1. Add `PARALLEL_API_KEY` as a CI/CD variable:

   - Go to Settings → CI/CD → Variables
   - Add variable with your API key
   - Make sure "Protect variable" and "Mask variable" are checked

2. Create `.gitlab-ci.yml`:

```yaml
extract-docs:
  image: node:20
  script:
    - npm install -g extract-from-sitemap
    - npx extract-from-sitemap
    - |
      git config user.email "gitlab-ci@gitlab.com"
      git config user.name "GitLab CI"
      git add docs/
      git diff --quiet && git diff --staged --quiet || \
        (git commit -m "Update docs [skip ci]" && git push https://oauth2:${CI_JOB_TOKEN}@${CI_SERVER_HOST}/${CI_PROJECT_PATH}.git HEAD:${CI_COMMIT_REF_NAME})
  only:
    - schedules
    - web
```

### Other CI Systems

The CLI automatically detects CI environments and will require the `PARALLEL_API_KEY` environment variable to be set. It will not attempt OAuth flow in CI environments.

Supported CI detection:

- GitHub Actions
- GitLab CI
- CircleCI
- Travis CI
- Jenkins
- Buildkite
- Drone
- Semaphore
- Any system with `CI=true` or `CONTINUOUS_INTEGRATION=true`

## Known limitations

This library is in active development. Known limitations:

- Does not work for nested sitemaps
- Does not work on sitemaps that are too large
- Some CI systems may require additional git configuration

I am working on addressing these issues.
