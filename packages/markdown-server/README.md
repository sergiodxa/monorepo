# @pkg/markdown-server

Server-side Markdown parsing and frontmatter validation for this monorepo.

## Overview

`@pkg/markdown-server` parses Markdown with Markdoc and validates frontmatter with Standard Schema. It owns the server-only parsing pipeline, including fenced-code normalization and Prism highlighting.

This package is intentionally framework-agnostic. The client renderer lives in `@pkg/markdown-remix`.

## Usage

```ts
import { Markdown } from "@pkg/markdown-server";
import { z } from "zod";

let markdown = new Markdown({
	frontmatter: z.object({ title: z.string() }),
});

let result = markdown.parse("---\ntitle: Hello\n---\n# Post");
```

## API

### `class Markdown<Schema>`

Parses Markdown into a Markdoc tree and validated frontmatter.

**Example:**

```ts
let markdown = new Markdown({ frontmatter: z.object({ title: z.string() }) });
```

### `Markdown.frontmatter(raw, schema)`

Extracts frontmatter and returns the remaining Markdown content.

### `MarkdownParseError`

Error thrown when frontmatter validation fails or async schemas are used.

### `fence`

Markdoc node definition that normalizes code fences for client renderers.

### `normalizeLanguage(language)`

Normalizes fence language aliases to Prism identifiers.

## Related Packages

- [`@pkg/markdown-remix`](/packages/markdown-remix) - Remix UI renderer for parsed Markdown.
- [`@pkg/result`](/packages/result) - Explicit success/failure return values.
- [`@pkg/validate`](/packages/validate) - Schema validation utilities.

## Tips

1. Parse once on the server, then reuse the parsed tree in the client renderer.
2. Keep frontmatter schemas synchronous.
3. Prefer aliases like `tsx`, `mdx`, or `sh` if you want Prism normalization.
