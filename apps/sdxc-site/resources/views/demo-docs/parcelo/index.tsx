/**
 * The API reference demo: Parcelo, an invented HTTP API that buys shipping labels and tracks
 * parcels, documented as resources with one page per endpoint. Set in a crisp, technical
 * register: cool slate neutrals, one indigo accent and method pills over mono paths.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DemoDocsSite } from "~/resources/views/demo-docs";

import { demoDocsHref } from "~/resources/views/demo-docs";
import {
	AUTHENTICATION,
	ERRORS,
	PAGINATION,
} from "~/resources/views/demo-docs/parcelo/introduction";
import {
	CREATE_SHIPMENT,
	LIST_SHIPMENTS,
	RETRIEVE_SHIPMENT,
	SHIPMENT_OBJECT,
} from "~/resources/views/demo-docs/parcelo/shipments";
import { RETRIEVE_TRACKER, WEBHOOK_EVENTS } from "~/resources/views/demo-docs/parcelo/tracking";

/** The addresses of Parcelo's pages. */
const href = demoDocsHref("parcelo");

/** An indigo ramp at hue 275, saturated enough to carry links and the POST pill. */
const BRAND = [
	"oklch(0.98 0.013 275)",
	"oklch(0.952 0.03 275)",
	"oklch(0.9 0.06 275)",
	"oklch(0.81 0.1 275)",
	"oklch(0.7 0.15 275)",
	"oklch(0.6 0.19 275)",
	"oklch(0.52 0.2 275)",
	"oklch(0.44 0.18 275)",
	"oklch(0.36 0.14 275)",
	"oklch(0.28 0.1 275)",
	"oklch(0.2 0.07 275)",
] as const;

/** Slate neutrals leaning blue, so the indigo reads as part of the same cool palette. */
const NEUTRAL = [
	"oklch(0.985 0.003 255)",
	"oklch(0.965 0.006 255)",
	"oklch(0.92 0.01 255)",
	"oklch(0.84 0.016 255)",
	"oklch(0.72 0.022 255)",
	"oklch(0.6 0.026 255)",
	"oklch(0.5 0.027 255)",
	"oklch(0.41 0.025 255)",
	"oklch(0.31 0.022 255)",
	"oklch(0.22 0.018 255)",
	"oklch(0.15 0.014 255)",
] as const;

/** A tight grotesk with a mono for paths and fields, and small, square corners. */
const TOKENS = {
	"--ui-font-sans":
		"Inter, 'Helvetica Neue', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
	"--ui-font-mono": "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
	"--demo-docs-heading-weight": "600",
	"--ui-radius-md": "0.375rem",
	"--ui-radius-lg": "0.5rem",
} as const;

/** The Parcelo mark: a parcel seen from a corner, its tape in white. */
function mark() {
	return (
		<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
			<rect x="2" y="2" width="20" height="20" rx="5" fill="var(--ui-color-brand-600)" />
			<path d="M7 9l5-2.5L17 9v6l-5 2.5L7 15z" fill="none" stroke="white" stroke-width="1.6" />
			<path d="M7 9l5 2.5L17 9M12 11.5v6" fill="none" stroke="white" stroke-width="1.6" />
		</svg>
	);
}

export default {
	name: "Parcelo",
	kind: "API reference",
	tagline: "Reference for a shipping-label API.",
	artDirection: "Slate, indigo and method pills.",
	description:
		"The HTTP API reference for Parcelo, a shipping-label API: resources, endpoints with request and response fields, and examples in three languages.",
	mark,
	theme: { brand: BRAND, neutral: NEUTRAL, tokens: TOKENS },
	tree: {
		label: "Parcelo API reference",
		sections: [
			{
				title: "Introduction",
				items: [
					{ title: "Authentication", href: href("introduction/authentication") },
					{ title: "Errors", href: href("introduction/errors") },
					{ title: "Pagination", href: href("introduction/pagination") },
				],
			},
			{
				title: "Shipments",
				items: [
					{ title: "The shipment object", href: href("shipments/object") },
					{ title: "Create a shipment", href: href("shipments/create"), badge: "POST" },
					{ title: "Retrieve a shipment", href: href("shipments/retrieve"), badge: "GET" },
					{ title: "List shipments", href: href("shipments/list"), badge: "GET" },
				],
			},
			{
				title: "Tracking",
				items: [
					{ title: "Retrieve a tracker", href: href("tracking/retrieve"), badge: "GET" },
					{ title: "Webhook events", href: href("webhooks/events") },
				],
			},
		],
	},
	hub: {
		eyebrow: "API reference",
		title: "Buy, print and track shipping labels",
		lead: "Parcelo is a REST API over HTTPS. It takes JSON, answers JSON, and authenticates every request with a secret key. Every example runs as written against a test key.",
		start: [
			{
				eyebrow: "Start here",
				title: "Authentication",
				description: "Get a test key and make your first request.",
				href: href("introduction/authentication"),
				cta: "Authenticate",
			},
			{
				eyebrow: "POST /v1/shipments",
				title: "Create a shipment",
				description: "Quote a parcel and buy its label in one request.",
				href: href("shipments/create"),
				cta: "See the endpoint",
			},
			{
				eyebrow: "Events",
				title: "Webhook events",
				description: "Hear about every scan and delivery as it happens.",
				href: href("webhooks/events"),
				cta: "Subscribe to events",
			},
		],
		topics: [
			{ title: "Idempotency", href: `${href("introduction/errors")}#retrying` },
			{ title: "Pagination", href: href("introduction/pagination") },
			{ title: "Verify signatures", href: `${href("webhooks/events")}#verify-the-signature` },
			{ title: "Error codes", href: `${href("introduction/errors")}#status-codes` },
		],
		sections: [
			{
				title: "Introduction",
				href: href("introduction/authentication"),
				description: "Keys, errors and pagination, which every endpoint shares.",
				count: 3,
			},
			{
				title: "Shipments",
				href: href("shipments/object"),
				description: "The shipment object and the endpoints that create and read it.",
				count: 4,
			},
			{
				title: "Tracking",
				href: href("tracking/retrieve"),
				description: "Where a parcel is, polled or pushed.",
				count: 2,
			},
		],
	},
	pages: {
		"introduction/authentication": AUTHENTICATION,
		"introduction/errors": ERRORS,
		"introduction/pagination": PAGINATION,
		"shipments/object": SHIPMENT_OBJECT,
		"shipments/create": CREATE_SHIPMENT,
		"shipments/retrieve": RETRIEVE_SHIPMENT,
		"shipments/list": LIST_SHIPMENTS,
		"tracking/retrieve": RETRIEVE_TRACKER,
		"webhooks/events": WEBHOOK_EVENTS,
	},
} satisfies DemoDocsSite;
