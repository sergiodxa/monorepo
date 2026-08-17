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

export default defineConfig({
	fmt: {
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
		// `templates/` is scaffolding with a placeholder package name and no installed
		// dependencies, so the type-aware path cannot resolve its types — the same reason
		// `bunfig.toml` keeps it out of the test run. It is checked once it is copied into a
		// real workspace.
		ignorePatterns: ["templates/**"],
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
