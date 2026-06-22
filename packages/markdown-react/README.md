# @pkg/markdown-react

React renderer for parsed Markdown content.

## Overview

`@pkg/markdown-react` renders Markdoc output with the monorepo's React UI components. It is the React-only client layer for Markdown, with a small default fence renderer and copy-to-clipboard support.

Use it when you already have parsed Markdown content from `@pkg/markdown-server` and want to render it inside a React app.

## Usage

```tsx
import { MarkdownView } from "@pkg/markdown-react";
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

Renders Markdoc output using React components.

**Props:**

- `content`: Parsed Markdoc tree
- `components?`: Custom component overrides keyed by tag name

### `Fence`

Default React fence renderer for highlighted code blocks.

### `CopyButton`

Clipboard button used by the default code fence header.

## Related Packages

- [`@pkg/markdown-server`](/packages/markdown-server) - Server-side parsing and highlighting.
- [`@pkg/markdown-remix`](/packages/markdown-remix) - Remix UI renderer for the same parsed content.
- [`@pkg/ui`](/packages/ui) - Shared UI primitives used by the renderer.
- [`@pkg/hooks`](/packages/hooks) - Shared hooks such as clipboard helpers.

## Tips

1. Pass `components` only for custom tag names you actually override.
2. Use the server package for parsing; this package only renders.
3. Keep code-fence copy targets stable if you customize the fence component.
