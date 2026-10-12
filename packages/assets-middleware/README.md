# @sdxc/assets-middleware

Router middleware that resolves a document's stylesheets and client entry once per request and publishes them on the request context as `ctx.assets`.

## Installation

```sh
npm add @sdxc/assets-middleware
```

It runs on a [`remix`](https://www.npmjs.com/package/remix) v3 router, and its lookups go through an [`@pitlane/assets`](https://www.npmjs.com/package/@pitlane/assets) resolver built from your build's manifest.

## Usage

### Publish the document's assets

Build the resolver once, then name the module whose stylesheets every page links and the browser entry every page loads. Both are source paths relative to the app root.

```typescript
import { assets } from "@sdxc/assets-middleware";
import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";
import { render } from "remix/middleware/render";
import { createRouter } from "remix/router";

let resolver = createAssetResolver(manifest);

let router = createRouter({
	middleware: [
		assets(resolver, { stylesheets: "app/document.tsx", script: "app/entry.browser.ts" }),
		render({ assets: resolver }),
	],
});
```

Both lookups run in parallel before the rest of the chain, and a failed lookup fails the request.

### Read `ctx.assets` in a route

```tsx
router.get("/", (ctx) =>
	ctx.render(
		<Document assets={ctx.assets}>
			<h1>Home</h1>
		</Document>,
	),
);
```

`ctx.assets.stylesheets` lists URLs in cascade order, and `ctx.assets.script` carries the entry's `href`, its `preloads` and the `importMap` they resolve by.

## API

### `assets(resolver: DocumentAssetsResolver, options: AssetsOptions): Middleware`

Resolves `options.stylesheets` and `options.script` through `resolver` and publishes the result as `ctx.assets` and under the `Assets` key. A router whose context is derived from its middleware list types `ctx.assets` from it; importing the package also adds `assets` to `remix/router`'s `RequestContext`.

### `Assets`

The context key the value is published under: `ctx.get(Assets)` returns the same object as `ctx.assets`.

### Types

#### `AssetsOptions`

- `stylesheets`: `string | readonly string[]`, the module or modules whose stylesheets every document links.
- `script`: `string`, the browser entry the document loads.
- `nonce`: `(ctx: RequestContext) => string | undefined`, optional; reads the CSP nonce for the inline import map. It runs on the first read of `ctx.assets.nonce`, at most once per request.

#### `DocumentAssets`

The published value: `stylesheets: string[]`, `script: ScriptEntry` (from `@pitlane/assets`) and `nonce?: string`, which is `undefined` without a `nonce` option.

#### `DocumentAssetsResolver`

The two lookups the middleware makes, `getStylesheets(path)` and `getScriptEntry(path)`. An `@pitlane/assets` resolver satisfies it, and so does any object answering both.

## Pattern: A Document Shell

The shell links every stylesheet, writes the import map before the preloads, and loads the entry as a module.

```tsx
import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Handle, RemixNode } from "remix/component";

import { ImportMap } from "remix/component/server";

interface DocumentProps {
	assets: DocumentAssets;
	children: RemixNode;
}

export function Document(handle: Handle<DocumentProps>) {
	return () => {
		let { nonce, script, stylesheets } = handle.props.assets;
		return (
			<html lang="en">
				<head>
					<meta charSet="utf-8" />
					{stylesheets.map((href) => (
						<link key={href} rel="stylesheet" href={href} />
					))}
					<ImportMap value={script.importMap} nonce={nonce} />
					{script.preloads.map((href) => (
						<link key={href} rel="modulepreload" href={href} />
					))}
				</head>
				<body>
					{handle.props.children}
					<script type="module" async src={script.href}></script>
				</body>
			</html>
		);
	};
}
```

## Pattern: Stylesheets From Several Modules

Pass an array when the document's styles come from more than one module; the URLs come back in import order, so the cascade matches the source.

```typescript
import { assets } from "@sdxc/assets-middleware";

let middleware = assets(resolver, {
	stylesheets: ["app/document.tsx", "app/theme.ts"],
	script: "app/entry.browser.ts",
});
```

## Pattern: A CSP Nonce For The Import Map

Publish the nonce from an earlier middleware and read it in `nonce`. The callback runs only when a page reads `ctx.assets.nonce`, so redirects and JSON responses never ask for one.

```typescript
import { assets } from "@sdxc/assets-middleware";
import { randomToken } from "@sdxc/crypto";
import { render } from "remix/middleware/render";
import { createContextKey, createRouter } from "remix/router";

let CspNonce = createContextKey<string>();

let router = createRouter({
	middleware: [
		async (ctx, next) => {
			let nonce = randomToken({ bytes: 16 });
			ctx.set(CspNonce, nonce);
			let response = await next();
			response.headers.set(
				"Content-Security-Policy",
				`script-src 'nonce-${nonce}' 'strict-dynamic'`,
			);
			return response;
		},
		assets(resolver, {
			stylesheets: "app/document.tsx",
			script: "app/entry.browser.ts",
			nonce: (ctx) => ctx.get(CspNonce),
		}),
		render({ assets: resolver }),
	],
});
```

## Pattern: Reading The Assets By Key

Code holding a context whose middleware chain it does not know reads the value through the `Assets` key.

```typescript
import type { RequestContext } from "remix/router";

import { Assets } from "@sdxc/assets-middleware";

function entryUrl(ctx: RequestContext) {
	return ctx.get(Assets).script.href;
}
```

## Pattern: Fixed Assets In A Test

The middleware reads whichever resolver it receives, so a test passes an object answering both lookups and asserts on known URLs.

```typescript
import type { DocumentAssetsResolver } from "@sdxc/assets-middleware";

import { assets } from "@sdxc/assets-middleware";
import { createRouter } from "remix/router";

let resolver: DocumentAssetsResolver = {
	getStylesheets: async () => ["/document.css"],
	getScriptEntry: async () => ({
		href: "/entry.js",
		preloads: ["/entry.js"],
		importMap: { imports: {} },
	}),
};

let router = createRouter({
	middleware: [
		assets(resolver, { stylesheets: "app/document.tsx", script: "app/entry.browser.ts" }),
	],
});

router.get("/", (ctx) => Response.json(ctx.assets.stylesheets));

let response = await router.fetch("https://example.com/");
await response.json(); // ["/document.css"]
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/assets-middleware": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
