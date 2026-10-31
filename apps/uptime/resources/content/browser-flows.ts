/**
 * Copy and example specs for the dedicated `/browser-flows` landing — the page that
 * sells real-browser click-through monitoring as its own product surface, apart from
 * the shared `/features/:slug` template every other capability uses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { formatUsd, PRICE_PER_FLOW_RUN_USD } from "~/config/pricing";

/** One click-through example shown on the landing and the homepage teaser. */
export interface BrowserFlowExample {
	/** Stable key for the homepage locale strings that title the same example. */
	key: "signIn" | "checkout" | "spa";
	/** The tab label naming this spec beside the other examples, short enough for three on a phone. */
	tab: string;
	title: string;
	description: string;
	source: string;
}

/**
 * Spec sources shown on the landing. The DSL is English by design, so these stay
 * module constants rather than locale strings.
 */
export const BROWSER_FLOW_EXAMPLES: readonly BrowserFlowExample[] = [
	{
		key: "signIn",
		tab: "sign-in",
		title: "Sign-in lands on the dashboard",
		description:
			"Fill the Email and Password fields, click Sign in, and expect the dashboard heading once the client has routed.",
		source: `use browser

test "signing in lands on the dashboard" {
	when {
		browser.open "https://app.example.com/login"
		browser.fill textbox "Email" with "m@example.com"
		browser.fill textbox "Password" with "monitor-pw"
		browser.click button "Sign in"
	}
	then {
		eventually within 5s {
			expect browser.path "/dashboard"
		}
		expect browser.heading "Dashboard"
	}
}`,
	},
	{
		key: "checkout",
		tab: "checkout",
		title: "Checkout reaches the confirmation",
		description:
			"Walk the cart through to pay, then assert on the confirmation heading that only renders after payment succeeds.",
		source: `use browser

test "checkout reaches confirmation" {
	when {
		browser.open "https://shop.example.com/cart"
		browser.click button "Checkout"
		browser.fill textbox "Card" with "4242424242424242"
		browser.click button "Pay now"
	}
	then {
		eventually within 10s {
			expect browser.heading "Order confirmed"
		}
	}
}`,
	},
	{
		key: "spa",
		tab: "settings",
		title: "A client-rendered page paints",
		description:
			"Open a SPA route and wait for the heading that hydration is supposed to show — a 200 on the shell is not enough.",
		source: `use browser

test "the settings page paints" {
	when {
		browser.open "https://app.example.com/settings"
	}
	then {
		eventually within 5s {
			expect browser.heading "Settings"
		}
		expect browser.button "Save"
	}
}`,
	},
];

/** Page chrome and section copy for `/browser-flows`. */
export const browserFlowsPage = {
	metaTitle: "Browser Flow Monitoring | Uptime",
	metaDescription:
		"Test your app in a real browser on a schedule — click, fill, and assert on what visitors see after JavaScript runs. Catch login and checkout breaks HTTP checks miss.",
	brand: "Uptime",
	title: "Test your app in",
	highlight: "a real browser",
	description:
		"A 200 on the homepage still hides a broken login. A browser flow clicks through the live page and asserts on what visitors see after JavaScript runs.",
	contrast: {
		badge: "Why a browser",
		title: "HTTP can only see the request",
		description:
			"An API flow signs in and calls the endpoint the token authorises — the right check when the path is JSON. A browser flow is for the failures that only appear once the page has painted: a client-rendered form, a checkout that depends on hydration, a dashboard that never routes.",
		http: {
			title: "HTTP flow",
			points: [
				"Posts credentials and reads the token back",
				"Bills one ping per request from the shared allowance",
				"Catches a broken session store or JWKS rotation",
			],
		},
		browser: {
			title: "Browser flow",
			points: [
				"Opens the page, fills fields, clicks buttons",
				`Bills ${formatUsd(PRICE_PER_FLOW_RUN_USD * 1000)} per 1,000 runs on its own meter`,
				"Catches a login that breaks only after JavaScript runs",
			],
		},
	},
	examples: {
		badge: "Examples",
		title: "Three click-throughs teams run on a schedule",
		description:
			"Each example is a short executable spec — the same language the dashboard editor uses. No Playwright suite to maintain.",
	},
	pricing: {
		badge: "Pricing",
		title: "Priced per run, not per click",
		description: `One browser run bills ${formatUsd(PRICE_PER_FLOW_RUN_USD * 1000)} per 1,000 on a separate flow-run meter — none included in the subscription. HTTP-only flows still draw from the shared ping allowance.`,
		figure: formatUsd(PRICE_PER_FLOW_RUN_USD * 1000),
		figureLabel: "per 1,000 browser runs",
		note: "Hourly sign-in check ≈ a few cents a month. Pair with a 1-minute HTTP monitor when you need faster detection on the endpoint the page depends on.",
	},
	steps: {
		badge: "How it works",
		title: "From a verified domain to a named failure",
		description:
			"Three steps from an empty dashboard to a click-through that pages you when it breaks.",
		list: [
			{
				title: "Verify the domain",
				description:
					"Prove the team controls the host the browser will drive. A session will not navigate outside verified domains.",
			},
			{
				title: "Write the click-through",
				description:
					'Open the page, fill fields by role and name, click the button, and assert on the heading or path that means "it worked".',
			},
			{
				title: "Get alerted on the failing step",
				description:
					"A broken sign-in or checkout alerts through your existing channels, naming the expectation that failed.",
			},
		],
		/**
		 * The sign-in example's run as the steps diagram plays it: each caption over the spec
		 * line from {@link BROWSER_FLOW_EXAMPLES} that performs it.
		 */
		diagram: {
			name: "A browser flow run, step by step",
			steps: [
				"Open the sign-in page",
				"Fill the Email field",
				"Click Sign in",
				"Expect the dashboard heading",
			],
			code: [
				'browser.open "…/login"',
				'browser.fill textbox "Email" with …',
				'browser.click button "Sign in"',
				'expect browser.heading "Dashboard"',
			],
		},
	},
	faqs: [
		{
			question: "When should I use a browser flow instead of HTTP?",
			answer:
				"When the failure only appears once JavaScript has run and the page is laid out — a client-rendered login, a checkout that depends on hydration, a dashboard that never paints. An API path that answers with JSON stays on an HTTP flow.",
		},
		{
			question: "How is a browser run billed?",
			answer: `One event per run on a separate flow-run meter at ${formatUsd(PRICE_PER_FLOW_RUN_USD * 1000)} per 1,000 runs — none included in the subscription — plus the measured session seconds on the cost ledger. HTTP-only flows still bill one ping per request from the shared allowance.`,
		},
		{
			question: "How often can a browser flow run?",
			answer:
				"Every 15 minutes at the fastest, then 30 minutes, hourly, every 3, 6 or 12 hours, or daily; hourly is the default. Pair it with a 1-minute HTTP monitor on the endpoint the page depends on when you need faster detection.",
		},
		{
			question: "Do I need Playwright or a test suite?",
			answer:
				"No. The flow is a short executable spec in the dashboard — open, fill, click, expect — not a repo of Playwright scripts to maintain. Teams that already own a Playwright suite and want monitors-as-code may still prefer a tool built around that model.",
		},
		{
			question: "What can't a browser flow express?",
			answer:
				"Branching, computation, and generated data. A signup that needs a fresh address every run wants a fixed fixture account, the same constraint every other flow has.",
		},
	],
	finalCta: {
		title: "Catch the break your visitors would hit",
		body: "Write a click-through once. Run it on a schedule. Get the failing line when the page stops working.",
	},
} as const;
