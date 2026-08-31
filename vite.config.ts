/**
 * Root Vite+ configuration: the single place formatting, linting and type checking are
 * configured for every workspace. Ported from `.oxlintrc.json` and `.oxfmtrc.json`, which
 * it replaces, so `vp check` runs all three as one pass instead of three separate tools
 * with no shared cache.
 *
 * Per-package settings belong in `lint.overrides` / `fmt.overrides` here rather than in a
 * config file next to the package, so there is one file to read to know how any file in
 * the repo is checked.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { TestProjectInlineConfiguration } from "vitest/config";

import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vite-plus";
import { defaultExclude } from "vitest/config";

import { cloudflareWorkersStub } from "./test/cloudflare-workers-plugin.ts";

/**
 * Executes inside workerd against the real bindings `apps/blog/wrangler.jsonc` declares.
 * Declared outside `projects`: alone here it has no `pool` of its own, and inlining it
 * sidesteps a TS2321 depth error from comparing this shape against every sibling in the array.
 */
/**
 * Bindings are declared inline rather than read from a wrangler config: a package has no
 * Worker of its own, so there is no config to point at, and miniflare creates whatever a test
 * names here. Sits outside `projects` for the same reason as {@link BLOG_WORKERS_PROJECT}.
 */
const PACKAGES_WORKERS_PROJECT: TestProjectInlineConfiguration = {
	plugins: [
		cloudflareTest({
			miniflare: {
				compatibilityDate: "2025-04-07",
				compatibilityFlags: ["nodejs_compat"],
				kvNamespaces: ["CACHE"],
				d1Databases: ["DB"],
			},
		}),
	],
	resolve: { tsconfigPaths: true },
	test: {
		name: "packages-workers",
		include: ["packages/*/src/**/*.workers.test.ts?(x)"],
		testTimeout: 20_000,
	},
};

/**
 * Takes its bindings from `apps/uptime`'s own wrangler config. Database-backed tests need
 * `node:sqlite`, absent from workerd, so they stay on the threads pool instead. Declared apart
 * from `projects` for the same reason as {@link BLOG_WORKERS_PROJECT}.
 */
const UPTIME_WORKERS_PROJECT: TestProjectInlineConfiguration = {
	root: "apps/uptime",
	plugins: [
		cloudflareTest({
			wrangler: { configPath: "./wrangler.jsonc" },
			/**
			 * The app declares `send_email` with `remote: true`, which would otherwise have the
			 * pool open a proxy session to the real account — failing CI for missing credentials,
			 * or reaching production where they exist. These tests assert against local KV instead.
			 */
			remoteBindings: false,
		}),
	],
	resolve: { tsconfigPaths: true },
	test: {
		name: "uptime-workers",
		include: ["**/*.workers.test.ts?(x)"],
		testTimeout: 20_000,
	},
};

const BLOG_WORKERS_PROJECT: TestProjectInlineConfiguration = {
	root: "apps/blog",
	plugins: [
		cloudflareTest({
			wrangler: { configPath: "./wrangler.jsonc" },
			/**
			 * Every binding stays local. The app has no `remote: true` binding today; declaring
			 * this keeps a future one from opening a proxy session to the real account, which
			 * needs credentials CI does not have and would point tests at production.
			 */
			remoteBindings: false,
		}),
	],
	resolve: { tsconfigPaths: true },
	test: {
		name: "blog-workers",
		include: ["**/*.workers.test.ts?(x)"],
		testTimeout: 20_000,
	},
};

export default defineConfig({
	run: {
		tasks: {
			/**
			 * Named apart from the `check` script, which Vite Task refuses to shadow, so `bun
			 * check` still gets the content-based cache. `test` stays a plain script: apps/pkmn's
			 * tests write into the workspace as their assertion, which busts the cache every run.
			 */
			"check:all": "vp check",
		},
	},

	test: {
		projects: [
			{
				/**
				 * The repo-root `test/` directory: cross-cutting guards that scan every workspace,
				 * so they belong to no single one.
				 */
				resolve: { tsconfigPaths: true },
				test: {
					name: "root",
					include: ["test/**/*.test.ts?(x)"],
					pool: "threads",
					testTimeout: 20_000,
				},
			},
			{
				/**
				 * One project covers every package: none of them uses a `~/*` alias or ships a
				 * Vite config, so the root tsconfig resolves them all. `.spec` files belong to
				 * `@pkg/spec`'s own runner and never match this glob.
				 */
				plugins: [cloudflareWorkersStub()],
				resolve: { tsconfigPaths: true },
				test: {
					name: "packages",
					include: ["packages/*/src/**/*.test.ts?(x)"],
					/**
					 * `*.workers.test.ts` belongs to `packages-workers`: those files import
					 * `cloudflare:test`, which exists only inside the Workers pool. Vitest's
					 * defaults are spread back in because naming `exclude` replaces them.
					 */
					exclude: [...defaultExclude, "**/*.workers.test.ts?(x)"],
					pool: "threads",
					/**
					 * Not inherited from the top-level `test` block: a project ignores it, so the
					 * 5s default applies unless set here. The slowest files spend ~4s applying
					 * every migration to a fresh database before their first assertion runs.
					 */
					testTimeout: 20_000,
				},
			},
			{
				/**
				 * Rooted at the app so its own tsconfig — and therefore the `~/*` aliases and
				 * `jsxImportSource` — apply, which a root-rooted run cannot see.
				 */
				root: "apps/uptime",
				plugins: [cloudflareWorkersStub()],
				resolve: { tsconfigPaths: true },
				test: {
					name: "uptime",
					include: ["**/*.test.ts?(x)"],
					/**
					 * `*.workers.test.ts` belongs to `uptime-workers`. Vitest's defaults are spread
					 * back in because naming `exclude` replaces them.
					 */
					exclude: [...defaultExclude, "**/*.workers.test.ts?(x)"],
					pool: "threads",
					/**
					 * Not inherited from the top-level `test` block: a project ignores it, so the
					 * 5s default applies unless set here. The slowest files spend ~4s applying
					 * every migration to a fresh database before their first assertion runs.
					 */
					testTimeout: 20_000,
				},
			},
			{
				root: "apps/blog",
				plugins: [cloudflareWorkersStub()],
				resolve: { tsconfigPaths: true },
				test: {
					name: "blog",
					include: ["**/*.test.ts?(x)"],
					/**
					 * `*.workers.test.ts` belongs to `blog-workers`, whose files need `cloudflare:test`
					 * from the Workers pool. Defaults are spread back in: dropping the `node_modules`
					 * default would send this glob through the app's symlinked deps, collecting the whole repo.
					 */
					exclude: [...defaultExclude, "**/*.workers.test.ts?(x)"],
					pool: "threads",
					/**
					 * Not inherited from the top-level `test` block: a project ignores it, so the
					 * 5s default applies unless set here. The slowest files spend ~4s applying
					 * every migration to a fresh database before their first assertion runs.
					 */
					testTimeout: 20_000,
				},
			},
			BLOG_WORKERS_PROJECT,
			PACKAGES_WORKERS_PROJECT,
			UPTIME_WORKERS_PROJECT,
			{
				root: "apps/r3-auth",
				plugins: [cloudflareWorkersStub()],
				resolve: { tsconfigPaths: true },
				test: {
					name: "r3-auth",
					/**
					 * Building a whole app in `beforeEach` — full migration plus an RSA key generated
					 * into R2 — fits the 10s default alone, but competing with the other projects' cores
					 * pushed hooks past it roughly one run in two. Set here since `test` isn't inherited.
					 */
					hookTimeout: 60_000,
					testTimeout: 60_000,
					include: ["**/*.test.ts?(x)"],
					pool: "threads",
				},
			},
			{
				root: "apps/books",
				plugins: [cloudflareWorkersStub()],
				resolve: { tsconfigPaths: true },
				test: {
					name: "books",
					include: ["**/*.test.ts?(x)"],
					pool: "threads",
					/**
					 * Not inherited from the top-level `test` block: a project ignores it, so the
					 * 5s default applies unless set here. The slowest files spend ~4s applying
					 * every migration to a fresh database before their first assertion runs.
					 */
					testTimeout: 20_000,
				},
			},
			{
				root: "apps/auth-saas",
				plugins: [cloudflareWorkersStub()],
				resolve: { tsconfigPaths: true },
				test: {
					name: "auth-saas",
					include: ["**/*.test.ts?(x)"],
					pool: "threads",
					/**
					 * Not inherited from the top-level `test` block: a project ignores it, so the
					 * 5s default applies unless set here. The slowest files spend ~4s applying
					 * every migration to a fresh database before their first assertion runs.
					 */
					testTimeout: 20_000,
				},
			},
			{
				root: "apps/blog-saas",
				plugins: [cloudflareWorkersStub()],
				resolve: { tsconfigPaths: true },
				test: {
					name: "blog-saas",
					include: ["**/*.test.ts?(x)"],
					pool: "threads",
					/**
					 * Not inherited from the top-level `test` block: a project ignores it, so the
					 * 5s default applies unless set here. The slowest files spend ~4s applying
					 * every migration to a fresh database before their first assertion runs.
					 */
					testTimeout: 20_000,
				},
			},
			{
				/**
				 * The one app whose sources live under `src/`, and the one with no Cloudflare
				 * bindings — nothing here imports `cloudflare:workers`, so the stub plugin has
				 * nothing to stand in for. Rooted at the app for its `~/*` aliases.
				 */
				root: "apps/pkmn",
				resolve: { tsconfigPaths: true },
				test: {
					name: "pkmn",
					/**
					 * Four dev-export tests snapshot, write and restore the app's real manifest and
					 * `src/assets` as their assertion. `bun test` ran files one at a time; in
					 * parallel, one file's restore clobbers another's write.
					 */
					fileParallelism: false,
					include: ["**/*.test.ts?(x)"],
					pool: "threads",
					/**
					 * Not inherited from the top-level `test` block: a project ignores it, so the
					 * 5s default applies unless set here. The slowest files spend ~4s applying
					 * every migration to a fresh database before their first assertion runs.
					 */
					testTimeout: 20_000,
				},
			},
		],
	},

	fmt: {
		/**
		 * Vendored third-party content. Oxfmt reformats fenced code inside markdown, which
		 * would rewrite 600+ files nobody here authored and make the next vendor sync a
		 * conflict; treat them as read-only.
		 */
		ignorePatterns: [".agents/**", "docs/vendor/**"],
		useTabs: true,
		experimentalSortPackageJson: true,
		experimentalSortImports: {
			groups: [
				["value-builtin"],
				["type-external"],
				["value-external"],
				["type-internal"],
				["value-internal"],
				["type-parent"],
				["value-parent"],
				["type-sibling"],
				["value-sibling"],
				["type-index"],
				["value-index"],
				["side_effect"],
			],
		},
	},

	lint: {
		options: {
			typeAware: true,
			typeCheck: true,
			denyWarnings: true,
		},
		plugins: [
			"eslint",
			"import",
			"jsdoc",
			"jsx-a11y",
			"node",
			"oxc",
			"promise",
			"typescript",
			"unicorn",
		],
		categories: {},
		rules: {
			"jsx_a11y/control-has-associated-label": "allow",
			"jsx_a11y/no-noninteractive-element-interactions": "allow",
			"jsx_a11y/prefer-tag-over-role": "allow",

			/**
			 * A statement that computes a value and drops it reads like an action while doing
			 * nothing. The strictest form applies, with no `allowShortCircuit` or `allowTernary`,
			 * because no expression in the repo needs them. A bare function call stays legal
			 * here: the rule judges the expression's form, so it says nothing about whether a
			 * caller uses what a call returns.
			 */
			"no-unused-expressions": "deny",
		},
		settings: {
			"jsx-a11y": {
				components: {
					Input: "input",
					Select: "select",
					Button: "button",
				},
			},
		},
		env: { builtin: true },
		globals: {},
		overrides: [
			{
				/**
				 * These components render an anchor, image or label whose content, `alt` text
				 * and associated control are supplied by the caller, so the rules cannot see
				 * them here.
				 */
				files: ["packages/ui/**"],
				rules: {
					"jsx_a11y/anchor-has-content": "allow",
					"jsx_a11y/alt-text": "allow",
					"jsx_a11y/label-has-associated-control": "allow",
				},
			},
		],
	},
});
