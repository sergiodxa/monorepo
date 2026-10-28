---
title: Make an MCP tool or resource
description: Write an MCP tool, or a resource with --resource, with sdxc make mcp, declared beside the others and mapped on the app's MCP server through lazy().
section:
    title: The sdxc command
    order: 2
order: 2.12
lastUpdated: 2026-10-25
outcomes:
    - "How to add an MCP tool, or a resource with `--resource`"
    - "Where the declaration and the handler go, and how they are mapped"
    - "How to fill in a tool's handler and test it"
---

An MCP tool is something an AI agent can call on your app, such as searching posts; a resource is
something it can read, such as an article. `sdxc make mcp` writes the handler in `app/mcp/tools/`
or `app/mcp/resources/`, declares it beside the others and maps it on the MCP server the template
serves at `/mcp`:

```bash
sdxc make mcp search-posts
sdxc make mcp article --resource
```

```text
Wrote app/mcp/tools/search-posts.ts
Wrote app/mcp/tools/search-posts.test.ts
Wrote spec/mcp/search-posts.spec
Edited app/mcp/tools/index.ts
Edited app/initializers/mcp.ts
```

## Flags

| Flag                  | Default      | What it does                                                        |
| --------------------- | ------------ | ------------------------------------------------------------------- |
| `--resource`          |              | write a resource in `app/mcp/resources/` instead of a tool          |
| `--test`, `--no-test` | `make.tests` | write the test beside it, or skip it                                |
| `--spec`, `--no-spec` | `make.specs` | write a tool's pairing `.spec` under `spec/mcp/`, or skip it        |
| `--dry-run`           |              | print the files and the diffs, and change nothing                   |
| `--force`             |              | replace the handler, its test and its spec, keeping the declaration |

## A tool

The handler answers with text, for you to replace with what the tool returns:

```typescript {% title="app/mcp/tools/search-posts.ts" %}
import { createTool } from "@sdxc/mcp/server";

import toolset from "~/app/mcp/tools";

export default createTool(toolset.searchPosts, () => "Search posts");
```

The tool is declared with a description and an empty input schema, and mapped on the handler the
initializer creates with `createHandler`:

```text
--- a/app/mcp/tools/index.ts
+++ b/app/mcp/tools/index.ts
-import { tools } from "@sdxc/mcp/server";
+import { tools, tool } from "@sdxc/mcp/server";
+import * as s from "@sdxc/json-schema";

-export default tools({});
+export default tools({
+	searchPosts: tool("search_posts", {
+		description: "Search posts.",
+		input: s.object({}),
+	}),
+});
--- a/app/initializers/mcp.ts
+++ b/app/initializers/mcp.ts
-import { createHandler } from "@sdxc/mcp/server";
+import { createHandler, lazy } from "@sdxc/mcp/server";
+import toolset from "~/app/mcp/tools";
@@
+mcp.tools.map(toolset.searchPosts, lazy(() => import("~/app/mcp/tools/search-posts")));
```

## A resource

`--resource` writes a handler that reads Markdown:

```typescript {% title="app/mcp/resources/article.ts" %}
import { createResource } from "@sdxc/mcp/server";

import resourceset from "~/app/mcp/resources";

export default createResource(resourceset.article, {
	read: () => "# Article\n",
});
```

and declares it under a URI, with its name and media type:

```typescript {% title="app/mcp/resources/index.ts" %}
export default resources({
	article: resource("app://article", {
		name: "Article",
		mimeType: "text/markdown",
	}),
});
```

The mapping is `mcp.resources.map(resourceset.article, lazy(() => import(…)))`. The URI's scheme
is your `package.json` name without its scope, so an app named `@acme/blog` declares
`blog://article`; a name with nothing usable left takes `app`.

## Names

Each name becomes three spellings:

| `sdxc make mcp posts/get-post`  | Value                                       |
| ------------------------------- | ------------------------------------------- |
| file                            | `app/mcp/tools/posts/get-post.ts`           |
| key                             | `toolset.posts.getPost`, in a `posts` group |
| tool name                       | `posts_get_post`, what an agent calls       |
| resource URI, with `--resource` | `<scheme>://posts/get-post`                 |

## The test

```typescript {% title="app/mcp/tools/search-posts.test.ts" %}
import { describe, expect, test } from "vitest";

import handler from "~/app/mcp/tools/search-posts";

describe("search-posts", () => {
	test("exports the handler the MCP server maps", () => {
		expect(handler).toBeDefined();
	});

	test.todo("answers Search posts");
});
```

```bash
bun run test app/mcp/tools/search-posts.test.ts
```

A tool also gets a pairing spec, which calls it over `/mcp` the way a client does and expects an
answer that is no error. Extend it with the arguments and the result the description promises;
[Write executable specs](/docs/operations-and-testing/executable-specs) covers running it:

```text {% title="spec/mcp/search-posts.spec" %}
use mcp

test "search_posts answers over /mcp" {
	when {
		let result = mcp.call "/mcp" "search_posts" {} on "web"
	}
	then {
		expect result.ok true
		expect result.is_error false
	}
}
```

## Fill it in

1. Describe the input in `app/mcp/tools/index.ts`, replacing `s.object({})` with the arguments
   an agent sends, such as `s.object({ query: s.string() })`, and write a description that tells
   a model when to call the tool and what it gets back.
2. Answer from the handler through what the server's context carries, such as your models, and
   return the text or structured content the description promises.
3. A resource with params declares them in its URI, such as `blog://posts/:slug`, and reads
   them in `read`, returning `null` for one that does not exist.

[Expose your app over MCP](/docs/operations-and-testing/mcp-server) covers the server, its context
and testing a tool through it; [Call an MCP server](/docs/operations-and-testing/mcp-client) and
[Bridge Cursor to a modern MCP server](/docs/operations-and-testing/mcp-bridge) cover the client
and the stdio bridge; [`@sdxc/mcp`](/api/mcp) is the whole API.

## Where to go next

- [Scaffold a resource](/docs/sdxc/scaffold-a-resource) — `--mcp` writes the list, get, create,
  update and delete tools for a model.
- [Make a policy](/docs/sdxc/make-policy) — the rule a tool asks before it answers.
- [Generate files](/docs/sdxc/generate-files) — the flags, configuration and stubs every kind
  shares.
