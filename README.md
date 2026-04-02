# n8n-nodes-qpdf

`n8n-nodes-qpdf` is a community node that wraps `qpdf` for common PDF transformations and adds a metadata-writing mode for PDF document info and XMP.

By default, `qpdf` warnings are treated as non-fatal. The node keeps the workflow moving and exposes warning text in the node JSON output instead of failing the execution.

## Requirements

- `qpdf` must be installed in the environment where n8n runs.
- `python3` and `pikepdf` are required for the `Set Metadata` operation.

## Operations

- Extract Pages
- Merge PDFs
- Rotate Pages
- Raw qpdf Arguments
- Set Metadata

## Guided operations

### Extract Pages

Uses `qpdf --pages` under the hood and accepts friendly page specs such as:

```text
1-2
1 - 2
1,3-5
1, 3 - 5, 7 - z
```

### Merge PDFs

Provide a comma-separated list of binary field names from the current item:

```text
invoicePdf,attachmentPdf,coverSheetPdf
```

### Rotate Pages

Provide a page selection and one of the built-in clockwise/counterclockwise rotations.

## Raw qpdf mode

Raw mode is for `qpdf` options that are not exposed by the node UI. Enter only the arguments, not the `qpdf` executable name.

### Placeholders

Use placeholders in the Raw Arguments field:

- `{{input1}}`, `{{input2}}`, ...
- `{{data}}` or any other input binary field name listed in `Input Binary Fields`
- `{{output}}`

### Examples

Extract pages using a placeholder:

```text
{{input1}} --pages {{input1}} 3-5 -- {{output}}
```

Linearize a PDF:

```text
--linearize {{data}} {{output}}
```

Decrypt with a supplied password:

```text
--password="{{inputPassword}}" {{data}} {{output}}
```

Apply qpdf stream/object normalization flags:

```text
--object-streams=disable --stream-data=uncompress {{data}} {{output}}
```

Note:

- Placeholders are validated. Unknown placeholders cause the node to fail fast.
- Quoted values are supported.
- Raw mode does not attempt to validate qpdf arguments beyond placeholder replacement.

## Set Metadata

`Set Metadata` accepts a JSON object with `pdf_metadata`, `xmp_metadata`, or both.

### JSON shape

```json
{
  "pdf_metadata": {
    "Title": "Example Title",
    "Subject": "Example Subject",
    "Creator": "n8n-nodes-qpdf"
  },
  "xmp_metadata": "<?xpacket begin=\"...\"?> ... <?xpacket end=\"w\"?>"
}
```

### `pdf_metadata`

Keys are mapped to PDF document info entries. The node accepts plain names like:

- `Title`
- `Subject`
- `Author`
- `Creator`
- `Producer`

They will be written as PDF info keys such as `/Title` and `/Creator`.

### `xmp_metadata`

When supplied, `xmp_metadata` should be a full XML XMP packet string. The node writes it as the PDF metadata stream.

### Example metadata payload

```json
{
  "pdf_metadata": {
    "Title": "Hammersmith & Fulham Council Tax Bill 2026-2027",
    "Subject": "Hammersmith & Fulham Council Tax Bill 2026-2027",
    "Creator": "n8n-nixnet"
  },
  "xmp_metadata": "<?xpacket begin=\"﻿\" id=\"W5M0MpCehiHzreSzNTczkc9d\"?>\n<x:xmpmeta xmlns:x=\"adobe:ns:meta/\">\n  <rdf:RDF xmlns:rdf=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\">\n    <rdf:Description rdf:about=\"\"\n      xmlns:dc=\"http://purl.org/dc/elements/1.1/\"\n      xmlns:xmp=\"http://ns.adobe.com/xap/1.0/\"\n      xmlns:pdf=\"http://ns.adobe.com/pdf/1.3/\"\n      xmlns:pdfx=\"http://ns.adobe.com/pdfx/1.3/\">\n      <dc:title>\n        <rdf:Alt><rdf:li xml:lang=\"x-default\">Hammersmith &amp; Fulham Council Tax Bill 2026-2027</rdf:li></rdf:Alt>\n      </dc:title>\n      <pdf:Producer>OpenAI Document Parser</pdf:Producer>\n      <pdfx:pageStart>1</pdfx:pageStart>\n      <pdfx:pageEnd>2</pdfx:pageEnd>\n    </rdf:Description>\n  </rdf:RDF>\n</x:xmpmeta>\n<?xpacket end=\"w\"?>"
}
```

## Development

```bash
npm install
npm run build
npm test
```
