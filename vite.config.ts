import { createRequire } from "node:module";

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
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vite-plus";
import { defaultExclude } from "vitest/config";

import { clientEntryIdentity } from "./test/client-entry-plugin.ts";
import { cloudflareWorkersStub } from "./test/cloudflare-workers-plugin.ts";

/**
 * The CommonJS entry of the CSS parser `linkedom` imports. The package's `browser` field names a
 * build that only assigns a global, so a browser project resolving it by that field finds none of
 * the exports `linkedom` reads; the `main` entry carries them.
 */
const CSSOM_ENTRY = createRequire(
	createRequire(`${import.meta.dirname}/packages/html/package.json`).resolve("linkedom"),
).resolve("@acemir/cssom");

/**
 * A test that needs a DOM runs in a real Chromium page through Vitest Browser Mode, so layout,
 * nested CSS, cascade layers and platform APIs behave as they do for a visitor. Such a file is
 * named `*.browser.test.ts(x)`; this builds the project that collects them for one workspace,
 * sharing the workspace's plugins and aliases with its threads project. Outbound HTTP is mocked
 * with `setupWorker` from `msw/browser`.
 *
 * @param name The workspace's threads project name; the browser project appends `-browser`.
 * @param base The workspace's root, plugins and resolve options.
 * @param include The globs to collect, relative to `base.root`.
 */
function browserProject(
	name: string,
	base: TestProjectInlineConfiguration,
	include = ["**/*.browser.test.ts?(x)"],
): TestProjectInlineConfiguration {
	return {
		...base,
		resolve: {
			...base.resolve,
			alias: { ...(base.resolve?.alias as Record<string, string>), "@acemir/cssom": CSSOM_ENTRY },
		},
		/** Serves MSW's `mockServiceWorker.js` from the page's root scope, where `setupWorker` registers it. */
		publicDir: `${import.meta.dirname}/test/browser-public`,
		test: {
			name: `${name}-browser`,
			include,
			browser: {
				enabled: true,
				headless: true,
				provider: playwright(),
				instances: [{ browser: "chromium" }],
				screenshotFailures: false,
			},
			testTimeout: 20_000,
		},
	};
}

/**
 * Wrangler announces every `.dev.vars` file it reads at its `log` level, so each Workers
 * project puts a `Using secrets defined in …` line in front of the run's results. Raising
 * the floor to `warn` keeps anything wrong with a binding visible and drops the rest. Set
 * here rather than in the `test` script so a scoped `vp test run <path>` is quiet too.
 */
process.env.WRANGLER_LOG ??= "warn";

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
				kvNamespaces: ["CACHE", "FLAGS"],
				d1Databases: ["DB"],
				r2Buckets: ["JWT_KEYS", "FILES"],
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
	resolve: {
		tsconfigPaths: true,
		alias: {
			"@pitlane/assets/manifest": `${import.meta.dirname}/apps/uptime/app/test/assets-manifest.ts`,
		},
	},
	test: {
		name: "uptime-workers",
		include: ["**/*.workers.test.ts?(x)"],
		testTimeout: 20_000,
	},
};

const BLOG_WORKERS_PROJECT: TestProjectInlineConfiguration = {
	root: "apps/blog",
	plugins: [
		clientEntryIdentity() as ReturnType<typeof cloudflareTest>,
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
	resolve: {
		tsconfigPaths: true,
		alias: {
			"@pitlane/assets/manifest": `${import.meta.dirname}/apps/blog/app/test/assets-manifest.ts`,
		},
	},
	test: {
		name: "blog-workers",
		include: ["**/*.workers.test.ts?(x)"],
		testTimeout: 20_000,
	},
};

/**
 * Takes its bindings from `apps/reader`'s own wrangler config. Declared apart from
 * `projects` for the same reason as {@link BLOG_WORKERS_PROJECT}.
 */
const READER_WORKERS_PROJECT: TestProjectInlineConfiguration = {
	root: "apps/reader",
	plugins: [
		cloudflareTest({
			wrangler: { configPath: "./wrangler.jsonc" },
			/**
			 * Every binding stays local. The app declares no `remote: true` binding today;
			 * stating this keeps a future one from opening a proxy session to the real
			 * account, which needs credentials CI does not have.
			 */
			remoteBindings: false,
		}),
	],
	resolve: {
		tsconfigPaths: true,
		alias: {
			"@pitlane/assets/manifest": `${import.meta.dirname}/apps/reader/app/test/assets-manifest.ts`,
		},
	},
	test: {
		name: "reader-workers",
		include: ["**/*.workers.test.ts?(x)"],
		testTimeout: 20_000,
	},
};

/**
 * Takes its bindings from `apps/auth-saas`'s own wrangler config. Tests over the tenant
 * object's database need `node:sqlite`, absent from workerd, so they stay on the threads
 * pool. Declared apart from `projects` for the same reason as {@link BLOG_WORKERS_PROJECT}.
 */
const AUTH_SAAS_WORKERS_PROJECT: TestProjectInlineConfiguration = {
	root: "apps/auth-saas",
	plugins: [
		cloudflareTest({
			wrangler: { configPath: "./wrangler.jsonc" },
			/**
			 * Every binding stays local, so a `remote: true` binding never opens a proxy session
			 * to the real account, which needs credentials CI does not have.
			 */
			remoteBindings: false,
		}),
	],
	resolve: {
		tsconfigPaths: true,
		alias: {
			"@pitlane/assets/manifest": `${import.meta.dirname}/apps/auth-saas/app/test/assets-manifest.ts`,
		},
	},
	test: {
		name: "auth-saas-workers",
		include: ["**/*.workers.test.ts?(x)"],
		testTimeout: 20_000,
	},
};

/**
 * One per workspace holding `*.browser.test.ts(x)` files. Declared apart from `projects` for the
 * same reason as {@link BLOG_WORKERS_PROJECT}.
 */
const PACKAGES_BROWSER_PROJECT = browserProject(
	"packages",
	{
		plugins: [cloudflareWorkersStub() as ReturnType<typeof cloudflareTest>],
		resolve: { tsconfigPaths: true },
	},
	["packages/*/src/**/*.browser.test.ts?(x)"],
);

const BLOG_BROWSER_PROJECT = browserProject("blog", {
	root: "apps/blog",
	plugins: [
		cloudflareWorkersStub() as ReturnType<typeof cloudflareTest>,
		clientEntryIdentity() as ReturnType<typeof cloudflareTest>,
	],
	resolve: {
		tsconfigPaths: true,
		alias: {
			"@pitlane/assets/manifest": `${import.meta.dirname}/apps/blog/app/test/assets-manifest.ts`,
		},
	},
});

const UPTIME_BROWSER_PROJECT = browserProject("uptime", {
	root: "apps/uptime",
	plugins: [
		cloudflareWorkersStub() as ReturnType<typeof cloudflareTest>,
		clientEntryIdentity() as ReturnType<typeof cloudflareTest>,
	],
	resolve: {
		tsconfigPaths: true,
		alias: {
			"@pitlane/assets/manifest": `${import.meta.dirname}/apps/uptime/app/test/assets-manifest.ts`,
		},
	},
});

const SDXC_SITE_BROWSER_PROJECT = browserProject("sdxc-site", {
	root: "apps/sdxc-site",
	plugins: [
		cloudflareWorkersStub() as ReturnType<typeof cloudflareTest>,
		clientEntryIdentity() as ReturnType<typeof cloudflareTest>,
	],
	resolve: {
		tsconfigPaths: true,
		alias: {
			"@pitlane/assets/manifest": `${import.meta.dirname}/apps/sdxc-site/app/test/assets-manifest.ts`,
		},
	},
});

const READER_BROWSER_PROJECT = browserProject("reader", {
	root: "apps/reader",
	plugins: [
		cloudflareWorkersStub() as ReturnType<typeof cloudflareTest>,
		clientEntryIdentity() as ReturnType<typeof cloudflareTest>,
	],
	resolve: {
		tsconfigPaths: true,
		alias: {
			"@pitlane/assets/manifest": `${import.meta.dirname}/apps/reader/app/test/assets-manifest.ts`,
		},
	},
});

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
		/**
		 * Console output reaches the terminal only from a failing test, where the wide event or
		 * swallowed error is the evidence; a passing run stays down to the summary.
		 */
		silent: "passed-only",
		projects: [
			{
				/**
				 * The repo-root `test/` directory: cross-cutting guards that scan every workspace,
				 * so they belong to no single one. Repo tooling under `scripts/` tests here too.
				 */
				resolve: { tsconfigPaths: true },
				test: {
					name: "root",
					include: [
						"test/**/*.test.ts?(x)",
						"scripts/**/*.test.ts",
						"cli/**/*.test.ts",
						".config/sdxc/checks/*.test.ts",
					],
					pool: "threads",
					testTimeout: 20_000,
				},
			},
			{
				/**
				 * One project covers every package: none of them uses a `~/*` alias or ships a
				 * Vite config, so the root tsconfig resolves them all. `.spec` files belong to
				 * `@sdxc/spec`'s own runner and never match this glob.
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
					exclude: [...defaultExclude, "**/*.workers.test.ts?(x)", "**/*.browser.test.ts?(x)"],
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
				plugins: [cloudflareWorkersStub(), clientEntryIdentity()],
				resolve: {
					tsconfigPaths: true,
					alias: {
						"@pitlane/assets/manifest": `${import.meta.dirname}/apps/uptime/app/test/assets-manifest.ts`,
					},
				},
				test: {
					name: "uptime",
					include: ["**/*.test.ts?(x)"],
					/**
					 * `*.workers.test.ts` belongs to `uptime-workers`. Vitest's defaults are spread
					 * back in because naming `exclude` replaces them.
					 */
					exclude: [...defaultExclude, "**/*.workers.test.ts?(x)", "**/*.browser.test.ts?(x)"],
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
				plugins: [cloudflareWorkersStub(), clientEntryIdentity()],
				resolve: {
					tsconfigPaths: true,
					alias: {
						"@pitlane/assets/manifest": `${import.meta.dirname}/apps/blog/app/test/assets-manifest.ts`,
					},
				},
				test: {
					name: "blog",
					include: ["**/*.test.ts?(x)"],
					/**
					 * `*.workers.test.ts` belongs to `blog-workers`, whose files need `cloudflare:test`
					 * from the Workers pool. Defaults are spread back in: dropping the `node_modules`
					 * default would send this glob through the app's symlinked deps, collecting the whole repo.
					 */
					exclude: [...defaultExclude, "**/*.workers.test.ts?(x)", "**/*.browser.test.ts?(x)"],
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
			BLOG_BROWSER_PROJECT,
			PACKAGES_WORKERS_PROJECT,
			PACKAGES_BROWSER_PROJECT,
			UPTIME_WORKERS_PROJECT,
			UPTIME_BROWSER_PROJECT,
			{
				root: "apps/r3-auth",
				plugins: [cloudflareWorkersStub(), clientEntryIdentity()],
				resolve: {
					tsconfigPaths: true,
					alias: {
						"@pitlane/assets/manifest": `${import.meta.dirname}/apps/r3-auth/app/test/assets-manifest.ts`,
					},
				},
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
				/**
				 * The talk's demo board. Rooted at the app for its `~/*` aliases, and given the
				 * Cloudflare stub because `cloudflare:workers` supplies the `DB` binding and the
				 * Turnstile keys the captcha provider chooses by. The asset manifest only a dev
				 * server or build writes comes from the app's test fixture.
				 */
				root: "apps/demo",
				plugins: [cloudflareWorkersStub()],
				resolve: {
					tsconfigPaths: true,
					alias: {
						"@pitlane/assets/manifest": `${import.meta.dirname}/apps/demo/app/test/assets-manifest.ts`,
					},
				},
				test: {
					name: "demo",
					include: ["**/*.test.ts?(x)"],
					pool: "threads",
					/**
					 * Not inherited from the top-level `test` block: a project ignores it, so the
					 * 5s default applies unless set here. The router tests apply the migration to a
					 * fresh database before their first assertion runs.
					 */
					testTimeout: 20_000,
				},
			},
			{
				root: "apps/books",
				plugins: [cloudflareWorkersStub()],
				resolve: {
					tsconfigPaths: true,
					alias: {
						"@pitlane/assets/manifest": `${import.meta.dirname}/apps/books/app/test/assets-manifest.ts`,
					},
				},
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
				root: "apps/sdxc-api",
				plugins: [cloudflareWorkersStub()],
				resolve: {
					tsconfigPaths: true,
					alias: {
						"@pitlane/assets/manifest": `${import.meta.dirname}/apps/sdxc-api/app/test/assets-manifest.ts`,
					},
				},
				test: {
					name: "sdxc-api",
					include: ["**/*.test.ts?(x)"],
					pool: "threads",
					testTimeout: 20_000,
				},
			},
			{
				root: "apps/sdxc-site",
				plugins: [cloudflareWorkersStub(), clientEntryIdentity()],
				resolve: {
					tsconfigPaths: true,
					alias: {
						"@pitlane/assets/manifest": `${import.meta.dirname}/apps/sdxc-site/app/test/assets-manifest.ts`,
					},
				},
				test: {
					name: "sdxc-site",
					include: ["**/*.test.ts?(x)", ".config/sdxc/checks/*.test.ts"],
					exclude: [...defaultExclude, "**/*.browser.test.ts?(x)"],
					globalSetup: ["scripts/catalogue.setup.ts"],
					pool: "threads",
					/**
					 * Not inherited from the top-level `test` block: a project ignores it, so the
					 * 5s default applies unless set here.
					 */
					testTimeout: 20_000,
				},
			},
			{
				root: "apps/auth-saas",
				plugins: [cloudflareWorkersStub(), clientEntryIdentity()],
				resolve: {
					tsconfigPaths: true,
					alias: {
						"@pitlane/assets/manifest": `${import.meta.dirname}/apps/auth-saas/app/test/assets-manifest.ts`,
					},
				},
				test: {
					name: "auth-saas",
					include: ["**/*.test.ts?(x)"],
					/**
					 * `*.workers.test.ts` belongs to `auth-saas-workers`. Vitest's defaults are
					 * spread back in because naming `exclude` replaces them.
					 */
					exclude: [...defaultExclude, "**/*.workers.test.ts?(x)", "**/*.browser.test.ts?(x)"],
					pool: "threads",
					/**
					 * Not inherited from the top-level `test` block: a project ignores it, so the
					 * 5s default applies unless set here. The slowest files spend ~4s applying
					 * every migration to a fresh database before their first assertion runs.
					 */
					testTimeout: 20_000,
				},
			},
			AUTH_SAAS_WORKERS_PROJECT,
			SDXC_SITE_BROWSER_PROJECT,
			{
				root: "apps/reader",
				plugins: [cloudflareWorkersStub(), clientEntryIdentity()],
				resolve: {
					tsconfigPaths: true,
					alias: {
						"@pitlane/assets/manifest": `${import.meta.dirname}/apps/reader/app/test/assets-manifest.ts`,
					},
				},
				test: {
					name: "reader",
					include: ["**/*.test.ts?(x)"],
					/**
					 * `*.workers.test.ts` belongs to `reader-workers`. Vitest's defaults are spread
					 * back in because naming `exclude` replaces them.
					 */
					exclude: [...defaultExclude, "**/*.workers.test.ts?(x)", "**/*.browser.test.ts?(x)"],
					pool: "threads",
					/**
					 * Not inherited from the top-level `test` block: a project ignores it, so the
					 * 5s default applies unless set here.
					 */
					testTimeout: 20_000,
				},
			},
			READER_WORKERS_PROJECT,
			READER_BROWSER_PROJECT,
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
		 * conflict; treat them as read-only. An OpenAPI snapshot is compared byte for byte
		 * with what `stringify` writes, so formatting it would fail the drift test, and the
		 * golden EPUB fixtures are compared byte for byte with what `EPUB.build` writes. MSW's
		 * service worker is regenerated by `msw init`, so it stays exactly as MSW writes it.
		 */
		ignorePatterns: [
			".agents/**",
			"docs/vendor/**",
			"**/openapi.snapshot.json",
			"packages/epub/src/fixtures/**",
			"test/browser-public/**",
			/** Generated Worker env types; `cf workers types` owns their layout. */
			"**/.cloudflare/**",
		],
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
		overrides: [
			{
				/**
				 * The sdxc-site guides render their code in a column 86 characters wide, with tabs
				 * drawn four columns wide. Formatting their samples to that width keeps every
				 * line of every guide visible without scrolling sideways.
				 */
				files: ["apps/sdxc-site/resources/docs/**/*.md"],
				options: { printWidth: 86, tabWidth: 4 },
			},
		],
	},

	lint: {
		options: {
			typeAware: true,
			typeCheck: true,
			denyWarnings: true,
		},
		/**
		 * `sdxc create`'s built-in templates import `sdxc/*` as an installed project does, so
		 * they resolve only once materialized; their own test materializes each one and type
		 * checks it there. MSW's generated service worker stays exactly as `msw init` writes it.
		 */
		ignorePatterns: ["packages/kit/templates/**", "test/browser-public/**"],
		plugins: [
			"eslint",
			"import",
			"jsdoc",
			"jsx-a11y",
			"node",
			"oxc",
			"promise",
			"react",
			"typescript",
			"unicorn",
		],
		categories: {},
		rules: {
			"jsx_a11y/control-has-associated-label": "allow",
			"jsx_a11y/no-noninteractive-element-interactions": "allow",
			"jsx_a11y/prefer-tag-over-role": "allow",
			/**
			 * Loading the react plugin for `jsx-max-depth` also turns on its style defaults;
			 * only the depth cap is part of this quality pass.
			 */
			"react/jsx-key": "allow",

			/**
			 * A statement that computes a value and drops it reads like an action while doing
			 * nothing. The strictest form applies, with no `allowShortCircuit` or `allowTernary`,
			 * because no expression in the repo needs them. A bare function call stays legal
			 * here: the rule judges the expression's form, so it says nothing about whether a
			 * caller uses what a call returns.
			 */
			"no-unused-expressions": "deny",

			/**
			 * Size and complexity caps (ADR-171). Oxlint defaults would fail thousands of
			 * existing functions; thresholds below are the adoption floor so CI stops further
			 * growth while screens and parsers are split. Competing duplicates stay `allow`
			 * so one plugin owns each check. Exemptions go in `lint.overrides` here — never
			 * `oxlint-disable` comments in source.
			 */
			"max-params": ["deny", { max: 11 }],
			"max-depth": ["deny", { max: 6 }],
			"max-lines-per-function": ["deny", { max: 500, skipBlankLines: true, skipComments: true }],
			"max-lines": ["deny", { max: 2000, skipBlankLines: true, skipComments: true }],
			"max-nested-callbacks": ["deny", { max: 10 }],
			"max-statements": ["deny", { max: 120 }],
			"max-classes-per-file": ["deny", { max: 12, ignoreExpressions: true }],
			complexity: ["deny", { max: 100 }],
			"no-else-return": "deny",
			/**
			 * Oxfmt strips the parentheses `unicorn/no-nested-ternary` requires, so that
			 * rule and the formatter thrash. Ban nesting outright with the eslint rule and
			 * rewrite to `if`/`else` or a named local instead.
			 */
			"eslint/no-nested-ternary": "deny",
			"unicorn/no-nested-ternary": "allow",
			"unicorn/max-nested-calls": ["deny", { max: 7 }],
			"react/jsx-max-depth": ["deny", { max: 12 }],

			/**
			 * Shape rules that keep control flow and collections readable. `== null` stays
			 * legal under `eqeqeq` because it is the repo's nullish check; eslint owns
			 * lonely-ifs, unicorn's duplicate stays off.
			 */
			eqeqeq: ["deny", "always", { null: "ignore" }],
			"no-var": "deny",
			"no-lonely-if": "deny",
			"unicorn/no-lonely-if": "allow",
			"no-unneeded-ternary": "deny",
			"no-useless-return": "deny",
			"default-case-last": "deny",
			"oxc/no-accumulating-spread": "deny",
			"unicorn/prefer-array-flat-map": "deny",
			"unicorn/prefer-array-flat": "deny",
			"no-param-reassign": "deny",
			"promise/param-names": "deny",
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
			{
				/**
				 * App controllers and views still carry page-sized functions and deep JSX.
				 * Packages keep the full size caps; apps keep nesting, params and hygiene,
				 * and take the stricter limits as those screens are split (ADR-171).
				 */
				files: ["apps/**"],
				rules: {
					"max-lines-per-function": "allow",
					"max-statements": "allow",
					"max-lines": "allow",
					"max-classes-per-file": "allow",
					"max-params": ["deny", { max: 10 }],
					complexity: ["deny", { max: 55 }],
					"react/jsx-max-depth": "allow",
				},
			},
			{
				/**
				 * Release and CLI scripts are orchestration, not library API surface; line and
				 * statement caps that keep packages small do not apply the same way here.
				 */
				files: ["scripts/**", "cli/**"],
				rules: {
					"max-lines-per-function": "allow",
					"max-statements": "allow",
					"max-lines": "allow",
					complexity: ["deny", { max: 55 }],
				},
			},
			{
				/**
				 * Locale catalogs, password dictionaries, icon registries and similar tables are
				 * generated or translated bulk data; splitting them to satisfy `max-lines` would
				 * only add indirection.
				 */
				files: [
					"**/*.data.ts",
					"**/locales/**",
					"**/resources/content/**",
					"packages/icons/src/registry.ts",
					"packages/icons/src/icon-names.ts",
					"packages/icons/src/index.ts",
					"packages/email-address/src/disposable-domains.ts",
					"packages/sample/src/data/**",
					"apps/pkmn/src/content/**",
				],
				rules: {
					"max-lines": "allow",
				},
			},
			{
				/**
				 * Domain error hierarchies keep related `Error` subclasses in one module so
				 * callers import from a single path; the class-per-file cap still applies
				 * everywhere else.
				 */
				files: ["**/errors.ts"],
				rules: {
					"max-classes-per-file": "allow",
				},
			},
			{
				/**
				 * Specs list many cases in one `it`/`describe`, so line and statement caps that
				 * keep production functions small punish the wrong thing here. Listed last so
				 * it wins over the apps override for app test files. Vitest loads only for
				 * tests so its defaults do not fire on app and package sources.
				 */
				files: [
					"**/*.test.ts",
					"**/*.test.tsx",
					"**/*.workers.test.ts",
					"**/*.workers.test.tsx",
					"**/test/**",
				],
				plugins: ["vitest"],
				rules: {
					"vitest/max-nested-describe": ["deny", { max: 5 }],
					/**
					 * Loading the vitest plugin also turns on its style defaults; those are not
					 * part of this quality pass and would fail under `denyWarnings`.
					 */
					"vitest/require-to-throw-message": "allow",
					"vitest/no-conditional-expect": "allow",
					"vitest/valid-expect": "allow",
					"vitest/valid-title": "allow",
					"vitest/expect-expect": "allow",
					"vitest/require-mock-type-parameters": "allow",
					"vitest/no-standalone-expect": "allow",
					"vitest/no-conditional-tests": "allow",
					"vitest/no-disabled-tests": "allow",
					"max-lines-per-function": "allow",
					"max-statements": "allow",
					"max-lines": "allow",
					"max-classes-per-file": "allow",
					"max-params": "allow",
					complexity: "allow",
					"react/jsx-max-depth": "allow",
					"unicorn/max-nested-calls": "allow",
					"promise/param-names": "allow",
				},
			},
		],
	},
});
