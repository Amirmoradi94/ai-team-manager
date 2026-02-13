# Install CLI
curl -fsSL https://cli.inference.sh | sh &#x26;&#x26; infsh login# Open a page and get interactive elements
infsh app run agent-browser --function open --input '{"url": "https://example.com"}' --session new