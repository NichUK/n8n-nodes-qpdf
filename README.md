# n8n-nodes-qpdf

Minimal n8n community node wrapper around the `qpdf` CLI.

## Requirements

- `qpdf` must be installed in the environment where n8n runs.

## Current operations

- Extract Pages
- Merge PDFs
- Rotate Pages
- Raw qpdf Arguments

## Raw qpdf mode

Use placeholders in the raw arguments field:

- `{{input1}}`, `{{input2}}`, ...
- `{{data}}` or any other input binary field name you listed
- `{{output}}`

Example:

```text
{{input1}} --pages {{input1}} 3-5 -- {{output}}
```

## Development

```bash
npm install
npm run build
```
