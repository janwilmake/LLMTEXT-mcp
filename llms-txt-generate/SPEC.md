RULES:
https://uithub.com/janwilmake/gists/tree/main/named-codeblocks.md

PROMPT:
manifest is a file of format: {
"/path/to/file.ext": {
"hash": "57954b95d599abf3d80d5ebdc9251b3a",
"size": 19
}
}

cli.js (nodejs without dependencies) is a cli that:

- reads manifest.json from cwd
- reads README.md from cwd
- takes --hostname {hostname} or looks in CNAME file (should be string containing hostname)
- takes -o or defaults to llms.txt
- writes output: README appended with section "# Files" and then all URLs to all files wrapped in markdown link with the filename without extension (e.g. [docs](https://mydomain.com/docs.md))
