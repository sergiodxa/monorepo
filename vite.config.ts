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
 * The Workers-pool project: these tests execute inside workerd with the real bindings
 * `apps/blog/wrangler.jsonc` declares, so a KV or D1 assertion is against Cloudflare's own
 * implementation rather than a hand-written stand-in. Bindings are not restated here — the
 * app's own config is the single source.
 *
 * `node:sqlite` does not exist in workerd, so a test whose database comes from
 * `@pkg/cloudflare-mocks/sqlite` stays in the `blog` project on the threads pool. The
 * `*.workers.test.ts` suffix is what selects a file into this one.
 *
 * Declared apart from the `projects` array on purpose: inline, it is the one entry with no
 * `pool` of its own — the plugin supplies it — and type checking the array then compares this
 * shape against every sibling and exceeds TypeScript's comparison depth (TS2321).
 */
/**
 * The Workers-pool project for packages. Bindings are declared inline rather than read from a
 * wrangler config: a package has no Worker of its own, so there is no config to point at, and
 * miniflare will create whatever a test names here.
 *
 * Declared apart from the `projects` array for the same reason as {@link BLOG_WORKERS_PROJECT}.
 */
const PACKAGES_WORKERS_PROJECT: TestProjectInlineConfiguration = {
	plugins: [
		cloudflareTest({
			miniflare: {
				compatibilityDate: "2025-04-07",
				compatibilityFlags: ["nodejs_compat"],
				kvNamespaces: ["CACHE"],
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
 * The Workers-pool project for `apps/uptime`, taking its bindings from the app's own wrangler
 * config. Only the tests that would otherwise stand in for a binding live here; the app's
 * database-backed tests need `node:sqlite`, which workerd does not have, so they stay on the
 * threads pool.
 *
 * Declared apart from the `projects` array for the same reason as {@link BLOG_WORKERS_PROJECT}.
 */
const UPTIME_WORKERS_PROJECT: TestProjectInlineConfiguration = {
	root: "apps/uptime",
	plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
	resolve: { tsconfigPaths: true },
	test: {
		name: "uptime-workers",
		include: ["**/*.workers.test.ts?(x)"],
		testTimeout: 20_000,
	},
};

const BLOG_WORKERS_PROJECT: TestProjectInlineConfiguration = {
	root: "apps/blog",
	plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
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
			// Named apart from the `check` script, which Vite Task refuses to shadow; the
			// script delegates here so `bun check` keeps working and gets the content-based
			// cache — a no-change re-run replays in ~240ms instead of ~9s.
			//
			// `test` is deliberately not a task. Vite Task reports it "modified its input":
			// apps/pkmn's dev-export tests write into the workspace while running, which is
			// what they assert, so the run invalidates its own cache every time.
			"check:all": "vp check",
		},
	},

	test: {
		projects: [
			{
				// The repo-root `test/` directory: cross-cutting guards that scan every workspace,
				// so they belong to no single one.
				resolve: { tsconfigPaths: true },
				test: {
					name: "root",
					include: ["test/**/*.test.ts?(x)"],
					pool: "threads",
					testTimeout: 20_000,
				},
			},
			{
				// One project covers every package: none of them uses a `~/*` alias or ships a
				// Vite config, so the root tsconfig resolves them all. `.spec` files belong to
				// `@pkg/spec`'s own runner and never match this glob.
				plugins: [cloudflareWorkersStub()],
				resolve: { tsconfigPaths: true },
				test: {
					name: "packages",
					include: ["packages/*/src/**/*.test.ts?(x)"],
					// `*.workers.test.ts` belongs to `packages-workers`: those files import
					// `cloudflare:test`, which exists only inside the Workers pool. Vitest's
					// defaults are spread back in because naming `exclude` replaces them.
					exclude: [...defaultExclude, "**/*.workers.test.ts?(x)"],
					pool: "threads",
					// Not inherited from the top-level `test` block: a project ignores it, so the
					// 5s default applies unless set here. The slowest files spend ~4s applying
					// every migration to a fresh database before their first assertion runs.
					testTimeout: 20_000,
				},
			},
			{
				// Rooted at the app so its own tsconfig — and therefore the `~/*` aliases and
				// `jsxImportSource` — apply, which a root-rooted run cannot see.
				root: "apps/uptime",
				plugins: [cloudflareWorkersStub()],
				resolve: { tsconfigPaths: true },
				test: {
					name: "uptime",
					include: ["**/*.test.ts?(x)"],
					// `*.workers.test.ts` belongs to `uptime-workers`. Vitest's defaults are spread
					// back in because naming `exclude` replaces them.
					exclude: [...defaultExclude, "**/*.workers.test.ts?(x)"],
					pool: "threads",
					// Not inherited from the top-level `test` block: a project ignores it, so the
					// 5s default applies unless set here. The slowest files spend ~4s applying
					// every migration to a fresh database before their first assertion runs.
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
					// `*.workers.test.ts` belongs to the `blog-workers` project: those files import
					// `cloudflare:test`, which exists only inside the Workers pool. Vitest's
					// defaults have to be spread back in — naming `exclude` replaces them, and
					// dropping `**/node_modules/**` sends this glob through the app's symlinked
					// workspace dependencies and collects the whole repo.
					exclude: [...defaultExclude, "**/*.workers.test.ts?(x)"],
					pool: "threads",
					// Not inherited from the top-level `test` block: a project ignores it, so the
					// 5s default applies unless set here. The slowest files spend ~4s applying
					// every migration to a fresh database before their first assertion runs.
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
					// Most tests here build a whole app in `beforeEach` — every migration against a
					// fresh in-memory database, and an RSA signing key generated into R2 on the
					// first request that needs one. That fits inside the 10s default hook timeout
					// when this project runs alone, but not while the other projects are competing
					// for the same cores, which showed up as hooks timing out in roughly one run in
					// two. Set on the project because a `test` option beside `projects` is not
					// inherited by them.
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
					// Not inherited from the top-level `test` block: a project ignores it, so the
					// 5s default applies unless set here. The slowest files spend ~4s applying
					// every migration to a fresh database before their first assertion runs.
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
					// Not inherited from the top-level `test` block: a project ignores it, so the
					// 5s default applies unless set here. The slowest files spend ~4s applying
					// every migration to a fresh database before their first assertion runs.
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
					// Not inherited from the top-level `test` block: a project ignores it, so the
					// 5s default applies unless set here. The slowest files spend ~4s applying
					// every migration to a fresh database before their first assertion runs.
					testTimeout: 20_000,
				},
			},
			{
				// The one app whose sources live under `src/`, and the one with no Cloudflare
				// bindings — nothing here imports `cloudflare:workers`, so the stub plugin has
				// nothing to stand in for. Rooted at the app for its `~/*` aliases.
				root: "apps/pkmn",
				resolve: { tsconfigPaths: true },
				test: {
					name: "pkmn",
					// Four of the dev-export tests snapshot, write and restore the app's real
					// manifest and `src/assets`, which they do deliberately — writing to the real
					// paths is what they assert. That only survived because `bun test` ran files
					// one at a time; in parallel one file's restore clobbers another's write.
					fileParallelism: false,
					include: ["**/*.test.ts?(x)"],
					pool: "threads",
					// Not inherited from the top-level `test` block: a project ignores it, so the
					// 5s default applies unless set here. The slowest files spend ~4s applying
					// every migration to a fresh database before their first assertion runs.
					testTimeout: 20_000,
				},
			},
		],
	},

	fmt: {
		// Vendored third-party content. Oxfmt reformats fenced code inside markdown, which
		// would rewrite 600+ files nobody here authored and make the next vendor sync a
		// conflict; they are read, not maintained.
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
				// These components render an anchor, image or label whose content, `alt` text and
				// associated control are supplied by the caller, so the rules cannot see them
				// here. Ported from the package's own `.oxlintrc.json`, which this replaces.
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
