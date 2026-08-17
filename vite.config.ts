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
import { defineConfig } from "vite-plus";

import { cloudflareWorkersStub } from "./test/cloudflare-workers-plugin";

export default defineConfig({
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
					// `@pkg/spec`'s `db` end-to-end tests connect through `new SQL(url)`, the one
					// Bun API with no `node:` counterpart and no driver this repo is willing to
					// depend on. They stay on `bun test`, which is the only reason it survives.
					exclude: ["packages/spec/src/plugins/db.test.ts"],
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
					pool: "threads",
					// Not inherited from the top-level `test` block: a project ignores it, so the
					// 5s default applies unless set here. The slowest files spend ~4s applying
					// every migration to a fresh database before their first assertion runs.
					testTimeout: 20_000,
				},
			},
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
