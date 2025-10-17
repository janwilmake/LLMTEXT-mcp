Sample curl command
curl --request POST \
 --url https://api.parallel.ai/v1beta/extract \
 --header 'Content-Type: application/json' \
 --header 'parallel-beta: search-extract-2025-10-10' \
 --header 'x-api-key: PARALLEL_API_KEY' \
 --data '{
"urls": ["https://en.wikipedia.org/wiki/Web_page"],
"full_content": true
}'
12:09
You can find the params in the internal-openapi.json file, where ExtractRequest is the input
class FetchPolicy(BaseModel):
"""Fetch policy.

    Determines when to return content from the cache (faster) vs fetching live content
    (fresher).
    """

    max_age_seconds: int | None = Field(
        description="Maximum age of cached content in seconds to trigger a live "
        "fetch. Minimum value 600 seconds (10 minutes). If not provided, a "
        "dynamic age policy will be used based on the search objective and url.",
        default=None,
    )
    timeout_seconds: float | None = Field(
        description="Timeout in seconds for fetching live content if unavailable in "
        "cache. If unspecified a dynamic timeout will be used based on the url, "
        "generally 15 seconds for simple pages and up to 60 seconds for complex pages "
        "requiring javascript or PDF rendering.",
        default=None,
    )
    disable_cache_fallback: bool = Field(
        description="If false, fallback to cached content older than max-age if live "
        "fetch fails or times out. If true, returns an error instead.",
        default=False,
    )

class FullContentSettings(BaseModel):
"""Optional settings for returning full content."""

    max_chars_per_result: int | None = Field(
        description="Optional upper bound on the number of characters to include in "
        "the full content for each url.",
        default=None,
    )

class ExcerptSettings(BaseModel):
"""Optional settings for returning relevant excerpts."""

    max_chars_per_result: int | None = Field(
        description="Optional upper bound on the total number of characters to include "
        "across all excerpts for each url.",
        default=None,
    )

class ExtractRequest(BaseModel):
"""Extract request."""

    urls: list[str]
    search_objective: str | None = Field(
        description="If provided, focuses extracted content on the specified search "
        "objective.",
        default=None,
    )
    search_queries: list[str] | None = Field(
        description="If provided, focuses extracted content on the specified keyword "
        "search queries.",
        default=None,
    )
    fetch_policy: FetchPolicy | None = Field(
        description="Fetch policy: determines when to return content from the cache "
        "(faster) vs fetching live content (fresher)",
        default=None,
    )

    excerpts: bool | ExcerptSettings = Field(
        description="Include excerpts from each URL relevant to the search objective "
        "and queries. Note that if neither search_objective nor search_queries is "
        "provided, excerpts are identical to full content.",
        default=True,
    )
    full_content: bool | FullContentSettings = Field(
        description="Include full content from each URL. Note that if neither "
        "search_objective nor search_queries is provided, full content is "
        "identical to excerpts.",
        default=False,
    )

(edited)

The output is ExtractResponse
class ExtractResult(BaseModel):
"""Extract result for a single URL."""

    url: str
    excerpts: list[str] | None = Field(
        description="Relevant excerpted content from the URL, formatted as markdown."
    )
    full_content: str | None = Field(
        description="Full content from the URL formatted as markdown, if requested."
    )
    title: str | None = Field(description="Title of the webpage, if available.")
    publish_date: str | None = Field(
        description="Publish date of the webpage, if available."
    )

class ExtractError(BaseModel):
"""Extract error details."""

    url: str
    error_type: str = Field(description="Error type.")
    message: str = Field(description="Human-readable error message.")
    http_status_code: int | None = Field(description="HTTP status code, if available.")
    content: str | None = Field(
        description="Content returned for http client or server errors, if any."
    )

class ExtractResponse(BaseModel):
"""Fetch result."""

    extract_id: str = Field(
        description="Extract request ID, e.g. "
        "`extract_cad0a6d2dec046bd95ae900527d880e7`"
    )
    results: list[ExtractResult] = Field(description="Successful extract results.")
    errors: list[ExtractError] = Field(
        description="Extract errors: requested URLs not in the results."
    )
