---
name: document-read
description: Read workspace documents (pdf, docx, markdown, text, tables) as plain text for coding tasks. Activate when the user asks to open/read a document, extract text from PDF/Word, 打开文档, 读 pdf/docx, 文档内容, or review a non-code file that is not a simple source file.
---

# Document read — prefer `read_document`

When the user wants the **contents of a document** (especially `.pdf` / `.docx` / long notes), call the tool **`read_document`** instead of shelling out to external converters.

## Tool

```
read_document({ path: "docs/spec.docx", maxChars?: 50000 })
```

- `path` — workspace-relative only (sandbox; escapes are rejected).
- `maxChars` — cap extracted text (default ~50k). For huge files, raise carefully or read in sections.

## Formats

| Kind | Behavior |
|------|----------|
| Text (`.md` `.txt` `.json` `.csv` …) | UTF-8 text |
| `.docx` | OOXML extract (`word/document.xml`) → plain text |
| `.pdf` | Best-effort pure-JS text extract; scanned/image PDFs may fail with a clear error |
| `.xlsx` / `.xls` | Unsupported — ask user to export CSV or paste the sheet |

## Practice

1. Prefer `read_document` over `shell` + `pandoc`/`pdftotext` for portability.
2. If `ok: false`, report the `error` and suggest alternatives (re-export, paste excerpt, OCR outside HFQ).
3. For source code, `read_file` is still fine; use `read_document` when the file is a **document** or binary office format.
4. After reading, summarize for the coding task; do not dump entire books into the reply.
