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
				// Rooted at the app so its own tsconfig — and therefore the `~/*` aliases and
				// `jsxImportSource` — apply, which a root-rooted run cannot see.
				root: "apps/uptime",
				plugins: [cloudflareWorkersStub()],
				resolve: { tsconfigPaths: true },
				test: {
					name: "uptime",
					// ADR-035 phase 2 pilot: only the converted files run under Vitest so far.
					include: [
						"app/lib/uptime-report.test.ts",
						"app/lib/concurrency.test.ts",
						"app/http/controllers/healthcheck-analytics-engine.test.ts",
						"app/lib/container.test.ts",
						"app/lib/cost-rates.test.ts",
						"app/lib/cron-text.test.ts",
						"app/lib/dns-record-value.test.ts",
						"app/lib/monitor-scope.test.ts",
						"app/lib/notify-queue.test.ts",
						"app/lib/pricing.test.ts",
						"app/lib/retention.test.ts",
						"app/lib/timezones.test.ts",
						"app/lib/trial-history.test.ts",
						"app/lib/trial-identity.test.ts",
						"app/do/geo-fetch.test.ts",
						"app/http/middleware/attribution.test.ts",
						"app/http/middleware/auth.test.ts",
						"app/http/middleware/i18n.test.ts",
						"app/http/middleware/require-api-key.test.ts",
						"app/http/middleware/require-role.test.ts",
						"app/http/middleware/require-team.test.ts",
						"app/http/middleware/require-user.test.ts",
						"app/http/middleware/session.test.ts",
						"app/data/account-deletion.test.ts",
						"app/data/alert-event.test.ts",
						"app/data/alert.test.ts",
						"app/data/api-key.test.ts",
						"app/data/content-check.test.ts",
						"app/data/cron-job.test.ts",
						"app/data/customer.test.ts",
						"app/data/dns-monitor-record.test.ts",
						"app/data/dns-monitor.test.ts",
						"app/data/invite.test.ts",
						"app/data/maintenance-window.test.ts",
						"app/data/monitor-daily-stats.test.ts",
						"app/data/status-page.test.ts",
						"app/data/subscription.test.ts",
						"app/data/team-domain.test.ts",
						"app/data/team.test.ts",
						"app/data/trial-daily-stats.test.ts",
						"app/http/controllers/default-handler.test.ts",
						"app/http/controllers/docs-index.test.ts",
						"app/http/controllers/healthcheck-analytics-engine-degraded.test.ts",
						"app/http/controllers/healthcheck.test.ts",
						"app/http/controllers/home.test.ts",
						"app/http/controllers/invite.test.ts",
						"app/http/controllers/logout.test.ts",
						"app/http/controllers/marketing-audience.test.ts",
						"app/http/controllers/marketing-comparison.test.ts",
						"app/http/controllers/marketing-feature.test.ts",
						"app/http/controllers/marketing-use-case.test.ts",
						"app/http/controllers/privacy.test.ts",
						"app/http/controllers/status-page.test.ts",
						"app/http/controllers/terms.test.ts",
						"app/http/controllers/app/index.test.ts",
						"app/http/controllers/app/team/account.test.ts",
						"app/http/controllers/app/team/dashboard-card-count.test.ts",
						"app/http/controllers/app/team/dashboard-card-slowest-endpoint.test.ts",
						"app/http/controllers/app/team/dashboard-card-uptime.test.ts",
						"app/http/controllers/app/team/dashboard-card-usage.test.ts",
						"app/http/controllers/app/team/dashboard-panel.test.ts",
						"app/http/controllers/app/team/dashboard-quick-ping-frame.test.ts",
						"app/http/controllers/app/team/dashboard-quick-ping.test.ts",
						"app/http/controllers/app/team/dashboard.test.ts",
						"app/http/controllers/app/team/index.test.ts",
						"app/http/controllers/app/team/settings.test.ts",
					],
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
