# @sdxc/assets-middleware

Router middleware that resolves a document's stylesheets and client entry once per request and publishes them on the request context as `ctx.assets`, so every route hands its document shell the URLs the build emitted.

## Installation

```bash
npm add @sdxc/assets-middleware
```

It goes on a `remix/router` middleware chain, so [`remix`](https://www.npmjs.com/package/remix) (v3) installs alongside it. The lookups go through an [`@pitlane/assets`](https://www.npmjs.com/package/@pitlane/assets) resolver the app builds from its own manifest.

## Usage

### Publish The Document's Assets

The app builds its resolver once over the manifest its Vite build provides, and names the module whose stylesheets every page links and the browser entry every page loads:

```typescript
import { assets } from "@sdxc/assets-middleware";
import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";
import { createRouter } from "remix/router";

let resolver = createAssetResolver(manifest);

let router = createRouter({
	middleware: [
		assets(resolver, {
			stylesheets: "resources/layouts/document.tsx",
			script: "bootstrap/browser.ts",
		}),
	],
});
```

### Render The Document

A route passes `ctx.assets` to its document shell, which links the stylesheets, writes the import map and loads the entry:

```tsx
router.get("/", (ctx) =>
	ctx.render(
		<Document assets={ctx.assets}>
			<h1>Home</h1>
		</Document>,
	),
);
```

### Attach A CSP Nonce

An app whose Content-Security-Policy requires a nonce on inline scripts reads it in `nonce`. The callback runs the first time a page reads `ctx.assets.nonce`, at most once per request, so a redirect or a JSON response never asks for a nonce it would not use. The middleware that publishes the nonce goes earlier in the chain:

```typescript
let router = createRouter({
	middleware: [
		securityHeaders(policy),
		assets(resolver, {
			stylesheets: "resources/layouts/document.tsx",
			script: "bootstrap/browser.ts",
			nonce: (ctx) => ctx.get(SecurityHeadersKey)?.nonce,
		}),
	],
});
```

`ctx.assets.nonce` is `undefined` when there is no callback or it returns none.

### Install Test Assets

The middleware reads whichever resolver it is given, so a test passes an object answering both lookups:

```typescript
let resolver = {
	getStylesheets: async () => ["/document.css"],
	getScriptEntry: async () => ({ href: "/browser.js", preloads: [], importMap: { imports: {} } }),
};
let router = createRouter({ middleware: [assets(resolver, options)] });
```

## API

### `assets(resolver: DocumentAssetsResolver, options: AssetsOptions): Middleware`

Returns a middleware that awaits `resolver.getStylesheets(options.stylesheets)` and `resolver.getScriptEntry(options.script)` in parallel before the rest of the chain runs, then sets the result as `ctx.assets` and under the `Assets` key. Its context transform types `ctx.assets` on a router whose context is derived from the middleware list; importing the package also adds `assets` to `remix/router`'s `RequestContext`. A rejected lookup rejects the request.

### `AssetsOptions`

| Option        | Type                                           | Description                                                          |
| ------------- | ---------------------------------------------- | -------------------------------------------------------------------- |
| `stylesheets` | `string \| readonly string[]`                  | Source path(s) of the modules whose stylesheets every document links |
| `script`      | `string`                                       | Source path of the browser entry                                     |
| `nonce`       | `(ctx: RequestContext) => string \| undefined` | Reads the CSP nonce the inline import map carries                    |

### `DocumentAssets`

The published value: `stylesheets` (URLs in cascade order), `script` (the entry's `href`, `preloads` and `importMap`) and `nonce`, read from the callback on first access.

### `DocumentAssetsResolver`

The two lookups the middleware makes, `getStylesheets` and `getScriptEntry`. An `@pitlane/assets` resolver satisfies it.

### `Assets`

The context key the value is published under. `ctx.get(Assets)` returns the same object as `ctx.assets`.

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
