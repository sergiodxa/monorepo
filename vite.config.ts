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
				// One project covers every package: none of them uses a `~/*` alias or ships a
				// Vite config, so the root tsconfig resolves them all. `.spec` files belong to
				// `@pkg/spec`'s own runner and never match this glob.
				plugins: [cloudflareWorkersStub()],
				resolve: { tsconfigPaths: true },
				test: {
					name: "packages",
					include: ["packages/arrays/src/**/*.test.ts?(x)", "packages/uuid/src/**/*.test.ts?(x)"],
					pool: "threads",
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
