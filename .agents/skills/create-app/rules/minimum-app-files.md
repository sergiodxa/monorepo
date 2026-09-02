---
title: The Minimum Files a New App Needs
impact: HIGH
tags: [apps, bootstrapping, structure]
---

# The Minimum Files a New App Needs

Fifteen files make an app that boots under `vite dev`, serves a page, renders a 404 for
anything unmapped, passes `vp check`, and deploys. Everything below is the whole content,
not a sketch. Write these, run `bun install` at the repo root, and the workspace is real.

Substitute `team-ops` for the app name and `3006` for the dev port throughout.

## Why

- **The old `templates/app` directory rotted precisely because it was a copy**: it still
  pinned `remix@3.0.0-beta.5`, `wrangler@^4.81.1`, and a `/.react-router` ignore entry
  from a framework the repo left behind, and it depended on no `@pkg/*` at all. Content
  that lives in a rule gets read and corrected; content that lives in a directory nobody
  runs does not.
- **Fifteen files is the floor, not the target.** `database/`, `public/`, `app/services/`,
  `app/models/` and the rest arrive when a feature needs them, so a young app has nothing
  in it that is not load-bearing.

## Pattern

### `package.json`

`typecheck` is present in every app even though `vp check` is what CI runs — it is the
second opinion `tsc` gives on the workspace. Add the two `db:*` scripts only if the app
declares a D1 binding.

```json
{
	"name": "@apps/team-ops",
	"private": true,
	"type": "module",
	"scripts": {
		"dev": "vite dev",
		"build": "vite build",
		"start": "vite preview",
		"cf:deploy": "bunx wrangler deploy",
		"cf:typegen": "bunx wrangler types",
		"typecheck": "tsc --noEmit"
	},
	"dependencies": {
		"@pkg/http": "workspace:*",
		"@pkg/logger": "workspace:*",
		"@pkg/result": "workspace:*",
		"@pkg/u": "workspace:*",
		"@pkg/ui": "workspace:*",
		"remix": "3.0.0-rc.1"
	},
	"devDependencies": {
		"@cloudflare/vite-plugin": "^1.52.1",
		"@total-typescript/ts-reset": "^0.6.1",
		"@types/node": "^26.2.0",
		"typescript": "^6.0.3",
		"vite": "^8.2.1",
		"wrangler": "^4.123.0"
	}
}
```

With a D1 binding named `DB`, add:

```json
"db:local:migrate": "bunx wrangler d1 migrations apply DB --local",
"db:remote:migrate": "bunx wrangler d1 migrations apply DB --remote"
```

Read the version pins off a sibling app rather than off this file, which is a snapshot
like any other; `bun run upgrade` moves them across the whole repo at once.

### `tsconfig.json`

```json
{
	"extends": "../../tsconfig.json",
	"include": [
		"app/**/*",
		"bootstrap/**/*",
		"config/**/*",
		"resources/**/*",
		"routes/**/*",
		"vite.config.ts",
		"worker-configuration.d.ts"
	],
	"compilerOptions": {
		"noEmit": true,
		"allowImportingTsExtensions": true,
		"jsx": "react-jsx",
		"jsxImportSource": "remix/ui",
		"types": ["@total-typescript/ts-reset", "vite/client", "bun"],
		"rootDirs": ["."],
		"paths": {
			"~/app/*": ["./app/*"],
			"~/bootstrap/*": ["./bootstrap/*"],
			"~/config/*": ["./config/*"],
			"~/resources/*": ["./resources/*"],
			"~/routes/*": ["./routes/*"]
		}
	}
}
```

Add a `~/database/*` path and a `database/**/*` include the day a `database/` directory
appears; the alias map and the include list track the directories that exist.

### `vite.config.ts`

```ts
/**
 * Vite build configuration for the team-ops app. Registers the Cloudflare plugin so the
 * worker runs in the SSR environment, and declares the client bundle entry with stable
 * asset file-naming so the document layout can link `/assets/clientEntry.js` directly
 * rather than resolving it through a manifest.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fileURLToPath } from "node:url";

import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

const clientEntryPath = fileURLToPath(new URL("./bootstrap/browser.ts", import.meta.url));

export default defineConfig({
	server: { port: 3006 },

	resolve: { tsconfigPaths: true },

	environments: {
		client: {
			build: {
				rollupOptions: {
					input: { clientEntry: clientEntryPath },
					output: {
						entryFileNames: "assets/[name].js",
						chunkFileNames: "assets/[name]-[hash].js",
					},
				},
			},
		},
	},

	plugins: [cloudflare({ viteEnvironment: { name: "ssr" } })],
});
```

### `wrangler.jsonc`

Bindings are added as the app earns them. An empty `d1_databases: []` with a placeholder
id is worse than no key at all — it fails the deploy rather than the review.

```jsonc
{
	"$schema": "https://unpkg.com/wrangler@latest/config-schema.json",
	"name": "team-ops",
	"main": "./bootstrap/worker.ts",
	"compatibility_date": "2026-04-10",
	"compatibility_flags": ["nodejs_compat"],
	"workers_dev": true,
	"dev": { "port": 3006 },
	"placement": { "mode": "smart" },
	"observability": { "enabled": true },
	"assets": { "directory": "./build/client" },

	// Plain secrets come from `.dev.vars` locally and `wrangler secret put` in
	// production; only bindings need an entry here.
}
```

### `.gitignore`

See [app-gitignore-entries](./app-gitignore-entries.md).

### `.env.example`

One commented group per concern, keys with empty values. This file is the contract for
what `.dev.vars` has to contain, so it is written at the same time as the first secret
read.

```dotenv
# Session
COOKIE_SESSION_SECRET=
```

### `README.md` and `AGENTS.md`

`README.md` follows [the app documentation guidelines](../../../../docs/guides/app-documentation.md) —
title, description, production URL, development steps, Cloudflare services table,
features, routes, scripts, deployment, environment variables. Do not restate that
structure here; open the guide.

`AGENTS.md` holds the app's own MUST/SHOULD rules and a reference-file list, and it
describes the app on its own terms — never as a copy of, or counterpart to, another app
or package.

### `LICENSE.md`

MIT, `Copyright (c) 2026 Sergio Xalambrí`. Copy the text from any sibling workspace.

### `bootstrap/worker.ts`

```ts
/**
 * Cloudflare Worker entry point. Its single `fetch` handler builds the application
 * router and forwards the request. It is the only module allowed to touch
 * Cloudflare-specific APIs, so everything below it is testable without a worker runtime.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import application from "./app";

export default {
	/** Handles an incoming request by forwarding it to the app router. */
	async fetch(request: Request) {
		let app = application();
		return await app.fetch(request);
	},
} satisfies ExportedHandler<Cloudflare.Env>;
```

Once the app resolves services through `@pkg/service-container`, the body becomes
`return await container.scope(async () => application().fetch(request))` so each request
gets its own resolution scope.

### `bootstrap/app.tsx`

The composition root: global middleware, route mapping, and the request-scoped renderer.
Tests fetch this router rather than assembling their own, which is why it is a function
and not a module-level singleton.

```tsx
/**
 * Application bootstrap that assembles the fetch-router. It registers the global
 * middleware stack (async context, request logging, form data, cross-origin protection,
 * HTML rendering), maps routes onto their controllers, and wires the request-scoped
 * renderer. It exists as the composition root shared by the worker and by router tests.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestContext } from "remix/router";
import type { RemixNode } from "remix/ui";

import logger from "@pkg/logger/middleware";
import { asyncContext } from "remix/middleware/async-context";
import { cop } from "remix/middleware/cop";
import { formData } from "remix/middleware/form-data";
import { renderWith } from "remix/middleware/render";
import { createHtmlResponse } from "remix/response/html";
import { createRouter } from "remix/router";
import { renderToStream } from "remix/ui/server";

import defaultHandler from "~/app/http/controllers/default-handler";
import home from "~/app/http/controllers/home";
import routes from "~/routes/web";

/**
 * Builds the HTTP router with its global middleware, route mappings, and HTML 404
 * fallback handler.
 *
 * @returns The configured router the worker forwards requests to.
 */
export default function application() {
	let globalMiddleware: Middleware[] = [
		asyncContext(),
		logger,
		formData() as Middleware,
		cop(),
		renderWith(createHtmlRenderer) as Middleware,
	];

	let router = createRouter({ middleware: globalMiddleware, defaultHandler });

	/* Mapped one leaf at a time: handing `router.map` a nested route map throws, so a
	route group is spread rather than passed whole. */
	router.map(routes.home, home);

	return router;
}

/**
 * Creates the request-scoped renderer controllers reach through `ctx.render`, streaming
 * a `remix/ui` node as an HTML response.
 */
function createHtmlRenderer(_ctx: RequestContext) {
	return function render(node: RemixNode, init?: ResponseInit) {
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		// `createHtmlResponse` rather than `new Response`, because it prepends
		// `<!DOCTYPE html>` to the stream's first chunk — the only place the doctype can
		// go, since JSX escapes text. Without it every page parses in quirks mode.
		return createHtmlResponse(renderToStream(node), { ...init, headers });
	};
}
```

### `bootstrap/browser.ts`

The client runtime entry. It stays wired into the build even before a page loads it, so
adding the first island does not mean reshaping the build first. Copy the `run({ … })`
body — the `loadModule` resolver and the `resolveFrame` fetch — from an app that already
hydrates; the two callbacks are protocol, not app code.

### `routes/web.ts`

```ts
/**
 * Route table. Every pattern here is a published contract — linked from pages, from
 * external dashboards, or from bookmarks — so patterns are added rather than reshaped.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { get, route } from "remix/routes";

/** Registers the app's routes. */
export default route({
	home: get("/"),
});
```

`route()` nests (`api: route({ … })`), and `form()` declares a GET/POST pair on one path.
Link with the typed `href()` off this table — `routes.home.href()` — never a string
literal, because a `prefix()`-mounted layout resolves a relative link against `/`.

### `app/http/controllers/home.tsx`

```tsx
/**
 * Homepage controller. Renders the landing document — the only page the app serves until
 * it has features, and the smoke test that the router, renderer, and layout agree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** GET / — the landing page. */
export default createAction(routes.home, (ctx) =>
	ctx.render(
		<DocumentLayout title="team-ops">
			<h1>team-ops</h1>
		</DocumentLayout>,
	),
);
```

### `app/http/controllers/default-handler.tsx`

```tsx
/**
 * Default request handler. Renders the 404 document for any request that matches no
 * route, so an unmapped URL answers with the app's own page rather than a bare framework
 * error.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import DocumentLayout from "~/resources/layouts/document";

/** Renders the 404 document for unmatched routes. */
export default function defaultHandler(ctx: RequestContext) {
	return ctx.render(
		<DocumentLayout title="404" description="The requested page could not be found.">
			<h1>404</h1>
			<p>The requested page could not be found.</p>
		</DocumentLayout>,
		{ status: 404 },
	);
}
```

### `resources/layouts/document.tsx`

The one place the `<html>`/`<head>`/`<body>` shell is assembled. Pages contribute content
and head values; they never build the shell themselves.

```tsx
/**
 * Root HTML document layout. Renders the html/head/body shell: the fixed head tags, the
 * page title and description, and every stylesheet the app ships. Every server-rendered
 * page composes into it, so a page decides only its own content.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { colorScheme } from "@pkg/u/color";
import { vstack } from "@pkg/u/layout";
import { minBs } from "@pkg/u/size";
import { font } from "@pkg/u/typography";
import resetStyles from "@pkg/ui/reset.css?url";
import themeStyles from "@pkg/ui/theme.css?url";

namespace DocumentLayout {
	export interface Props {
		/** The page's content, rendered inside `<body>`. */
		children: RemixNode;
		/** The document title. */
		title: string;
		/** Meta description for this page. */
		description?: string;
	}
}

/** Renders the outer `<html>`/`<head>`/`<body>` shell around `children`. */
export default function DocumentLayout(handle: Handle<DocumentLayout.Props>) {
	return () => {
		let { children, description, title } = handle.props;

		return (
			<html lang="en" mix={[colorScheme("light dark")]}>
				<head>
					<meta charSet="utf-8" data-key="charset" />
					<meta name="viewport" content="width=device-width, initial-scale=1" data-key="viewport" />
					<title data-key="title">{title}</title>
					{description ? (
						<meta name="description" content={description} data-key="description" />
					) : null}
					{/* Reset first, then the semantic tokens that read the palette through `var()`. */}
					<link rel="stylesheet" href={resetStyles} data-key="style-reset" />
					<link rel="stylesheet" href={themeStyles} data-key="style-theme" />
				</head>
				<body mix={[vstack({ align: "center" }), minBs("100dvh"), font("sans")]}>{children}</body>
			</html>
		);
	};
}
```

A component is always used as JSX with the `Handle` pattern, never called as a plain
function, even for a one-off helper.

### `config/router-context.d.ts`

Global middleware populates the request context through transforms, which route handlers
are not typed against. This augmentation is what surfaces those values.

```ts
import type { Renderer } from "remix/middleware/render";
/**
 * Router context values installed by globally-applied middleware. `bootstrap/app.tsx`
 * installs `formData()` and `renderWith(createHtmlRenderer)`; both populate the context
 * through transforms rather than through the route handler's own typing, so this
 * augmentation is what surfaces them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type {} from "remix/router";
import type { RemixNode } from "remix/ui";

declare module "remix/router" {
	interface RequestContext {
		/** Renders a `remix/ui` node into an HTML `Response`. */
		render: Renderer<RemixNode>;
		/** The request's parsed `FormData`, populated by the global `formData()` middleware. */
		formData: FormData;
	}
}

export {};
```

`oxfmt` sorts imports and will drag a file header off line 1 when a type-only import
sorts above it; this file shows the resulting layout, which is correct and stable.

### After writing

```bash
bun install                             # from the repo root, so the workspace resolves
(cd apps/team-ops && bun run cf:typegen)  # writes the gitignored worker-configuration.d.ts
vp check                                # format, lint, and type check
```

## Rules

1. Write the fifteen files, then `bun install` at the repo root
2. Read version pins off a sibling app, never off this rule
3. Declare a binding in `wrangler.jsonc` only when the app uses it; a placeholder id fails the deploy instead of the review
4. Run `cf:typegen` before the first type check — `worker-configuration.d.ts` is generated and gitignored
5. Start every file with the module JSDoc header, `@author` and `@copyright` included
6. Add `database/`, `public/`, `app/services/` and the rest when a feature needs them, not up front
