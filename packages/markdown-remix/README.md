# @pkg/markdown-remix

Remix UI renderer for parsed Markdown content.

## Overview

`@pkg/markdown-remix` renders Markdoc output with the `remix/ui` runtime instead of React DOM. It owns the SSR-friendly Markdown view used by Remix-based apps in this monorepo.

Pair it with `@pkg/markdown-server` for parsing and frontmatter validation. The package keeps the Remix-specific renderer and code-fence UI isolated from the server-side parsing pipeline.

## Usage

```tsx
import { MarkdownView } from "@pkg/markdown-remix";
import { Markdown } from "@pkg/markdown-server";
import { z } from "zod";

let markdown = new Markdown({ frontmatter: z.object({}) });
let result = markdown.parse("# Hello");

if (result.status === "success") {
	return <MarkdownView content={result.data.content} />;
}
```

## API

### `function MarkdownView(props)`

Renders Markdoc output into Remix UI nodes.

**Props:**

- `content`: Parsed Markdoc tree
- `components?`: Custom component overrides keyed by tag name

### `MarkdownViewComponents`

Type for custom Markdoc tag renderers.

### `Fence`

Remix code-fence renderer used by the default Markdoc pipeline.

### `renderToRemix(content, components)`

Converts a Markdoc AST into Remix UI nodes.

## Related Packages

- [`@pkg/markdown-server`](/packages/markdown-server) - Server parsing and highlighting.

## Tips

1. Keep this package Remix-only; do not import React DOM rendering helpers here.
2. Use `@pkg/markdown-server` for parsing and this package only for SSR output.
3. Prefer custom tag overrides only when you need app-specific markup.
