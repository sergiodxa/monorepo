/**
 * A catalog-wide guard against one silent CSS failure: `remix/component`'s style
 * serializer only treats a nested style-tree key as a selector when it leads
 * with `&`, `@`, `:`, `[` or `.` — every other key falls through to the
 * declaration path and serializes as `key: [object Object]`, which browsers
 * drop without a word. That string is the whole bug class's fingerprint, so
 * rendering every exported component and asserting it never appears catches
 * each future instance with one assertion.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { jsx } from "remix/component/jsx-runtime";
import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

/**
 * Every component module of the package: the general components and each namespace's,
 * read from their files so the helpers a namespace barrel also forwards stay out.
 */
const MODULES = import.meta.glob<Record<string, unknown>>(
	[
		"./*.tsx",
		"../{landing,docs,chat,color,app,video,map,travel,finance}/*.tsx",
		"!./*.test.tsx",
		"!../*/*.test.tsx",
	],
	{ eager: true },
);

/**
 * The fingerprint every instance of this bug class leaves in the stylesheet:
 * a nested block stringified as a declaration value.
 */
const FINGERPRINT = "[object Object]";

/**
 * Props handed to every probe render. Compound members that read required data
 * off their own props (a chart series, a selectable item's value, highlighted
 * segments, a shortcut's keys, a list's items, a tree's nodes, a docs tree) throw before
 * emitting any CSS otherwise, which would quietly shrink the sweep.
 */
const PROBE_PROPS = {
	value: "a",
	data: [{ label: "a", value: 1, x: 1, y: 1 }],
	segments: [{ text: "a", match: true }],
	keys: ["a"],
	items: [],
	nodes: [],
	tree: { label: "a", sections: [] },
	code: "a",
	tabs: [],
	presets: [],
	periods: [],
	values: [],
	rows: [],
	packages: [],
	runs: [],
	groups: [],
	days: [],
	labels: {
		copy: "a",
		copied: "a",
		name: "a",
		type: "a",
		default: "a",
		required: "a",
		status: {},
		methods: {},
	},
	"aria-label": "a",
	series: [],
	source: { title: "a" },
	targets: [],
	trigger: { title: "a" },
	steps: [],
	outcome: "a",
	words: ["a"],
	actors: [],
	messages: [],
	columns: [],
	lines: [],
	start: [],
	sections: [],
	links: [],
	path: "/a",
	name: "a",
	href: "/a",
	children: "probe",
};

/** The two ends and length every flight component draws its route from. */
const PROBE_ROUTE = {
	departure: { time: "a", code: "AAA" },
	arrival: { time: "a", code: "BBB" },
	duration: "a",
	airline: "a",
};

/**
 * Props a component reads under a name another component's probe already claims with a
 * different shape, keyed by the component's export name and spread over {@link PROBE_PROPS}.
 * A compound's members render with their root's entry, so it carries their props too.
 */
const PROBE_OVERRIDES: Record<string, Record<string, unknown>> = {
	RatingInput: { legend: "a", labels: ["a", "b"] },
	GeoMap: {
		id: "a",
		label: "a",
		center: [0, 0],
		zoom: 3,
		at: [0, 0],
		path: [
			[0, 0],
			[1, 1],
		],
		form: "a",
		labels: {
			zoomIn: "a",
			zoomOut: "a",
			reset: "a",
			locate: "a",
			fullscreen: "a",
			cluster: "a",
			gestureHint: "a",
		},
	},
	BoardingPass: {
		label: "a",
		airline: { name: "a" },
		passenger: "a",
		from: { code: "AAA", city: "a", time: "a" },
		to: { code: "BBB", city: "a", time: "a" },
		flight: "a",
		date: "a",
		gate: "a",
		boards: "a",
		seat: "a",
		zone: "a",
		cabin: "a",
		confirmation: "a",
		code: "a",
		labels: {
			passenger: "a",
			flight: "a",
			date: "a",
			gate: "a",
			boards: "a",
			seat: "a",
			zone: "a",
			cabin: "a",
			confirmation: "a",
			code: "a",
		},
	},
	FareCalendar: {
		month: "2026-03",
		fares: {},
		href: () => "/a",
		locale: "en-US",
		label: "a",
		labels: { previous: "a", next: "a", cheapest: "a", noFlights: "a" },
	},
	FlightItinerary: { ...PROBE_ROUTE, toggleLabel: "a" },
	FlightOption: { ...PROBE_ROUTE, price: "a" },
	FlightRoute: PROBE_ROUTE,
	FlightSegment: PROBE_ROUTE,
	SeatMap: {
		rows: [{ number: 1, seats: [{ id: "1A", status: "available" }] }],
		layout: "A",
		label: "a",
		labels: { taken: "a" },
	},
	ReelFeed: { offset: 0, sources: [{ src: "/a.mp4", type: "video/mp4" }], labels: { pause: "a" } },
	StoryViewer: {
		closeHref: "/a",
		durations: [1],
		current: 0,
		previousHref: "/a",
		nextHref: "/a",
		labels: { close: "a", pause: "a", previous: "a", next: "a" },
	},
	Amount: { value: 1299, currency: "EUR" },
	Autocomplete: { id: "a", label: "a", options: [{ value: "a", label: "a", description: "a" }] },
	Lightbox: { id: "a", label: "a", photos: [{ alt: "a" }], lightbox: "a" },
	RangeMonths: {
		month: "2026-03",
		start: undefined,
		href: () => "/a",
		labels: { previous: "a", next: "a" },
	},
	RatingBreakdown: { score: 4.5, kind: "stars", label: "a", value: 0.5, display: "a" },
	ContributionGraph: {
		start: "2026-01-01",
		end: "2026-01-14",
		href: () => "/a",
		labels: { caption: "a", day: () => "a", less: "a", more: "a" },
	},
	Diff: {
		status: "modified",
		additions: 1,
		deletions: 1,
		hunks: [
			{
				oldStart: 1,
				oldLines: 1,
				newStart: 1,
				newLines: 1,
				lines: [
					{ kind: "del", old: 1, text: "a", words: [[0, 1]] },
					{ kind: "add", new: 1, text: "b", words: [[0, 1]] },
				],
			},
		],
		view: "unified",
		unifiedHref: "/a",
		splitHref: "/a",
		labels: {
			copied: "a",
			view: "a",
			unified: "a",
			split: "a",
			filesViewed: "a",
			columns: { oldNumber: "a", newNumber: "a", oldText: "a", change: "a" },
			copyPath: "a",
			statuses: { modified: "a" },
			changes: () => "a",
			binary: "a",
			tooLarge: "a",
			largeDiff: "a",
		},
	},
	EpisodePlayer: {
		src: "/a.mp3",
		captions: { src: "/a.vtt", srclang: "en", label: "a" },
		chaptersLabel: "a",
		transcriptLabel: "a",
		fallback: "a",
		chapters: [{ start: 0, title: "a" }],
		transcript: [{ start: 0, text: "a" }],
	},
	CaseStudy: {
		client: "a",
		scene: "a",
		sceneLabel: "a",
		problem: "a",
		built: "a",
		result: { value: "a", label: "a" },
	},
	ReviewThread: {
		comments: [{ avatar: "a", author: "a", body: "a", pending: true }],
		replyAction: "/a",
		resolveAction: "/a",
		labels: {
			reply: "a",
			resolve: "a",
			unresolve: "a",
			outdated: "a",
			pending: "a",
			suggestion: "a",
			applySuggestion: "a",
			columns: { oldNumber: "a", newNumber: "a", oldText: "a", change: "a" },
		},
	},
};

/** The probe props for the component exported as `name`. */
function probeProps(name: string): Record<string, unknown> {
	return { ...PROBE_PROPS, ...PROBE_OVERRIDES[name] };
}

/**
 * Anything exported under a PascalCase name is a component; the catalog also
 * exports camelCase helpers (mix builders, context readers) that are not
 * renderable and carry no styles of their own.
 */
function isComponent(name: string, value: unknown): value is Function {
	return typeof value === "function" && /^[A-Z]/.test(name);
}

/**
 * Renders `element` and returns the CSS text of every `<style>` tag it
 * emitted, or `null` when the component needs an ancestor for context;
 * callers use `null` as a signal to retry through a different wrapper.
 */
async function styleOf(element: unknown): Promise<string | null> {
	try {
		let html = await renderToString(element as never);
		return [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
			.map((match) => match[1])
			.join("\n");
	} catch {
		return null;
	}
}

describe("component catalog CSS", () => {
	let catalog = Object.assign({}, ...Object.values(MODULES)) as Record<string, unknown>;
	let roots = Object.entries(catalog).filter(([name, value]) => isComponent(name, value));

	test("exports a catalog large enough for this sweep to mean anything", () => {
		expect(roots.length).toBeGreaterThan(50);
	});

	for (let [name, root] of roots) {
		let members = Object.entries(root as Record<string, unknown>).filter(([key, value]) =>
			isComponent(key, value),
		);

		test(`${name} emits no stringified style block`, async () => {
			let css = await styleOf(jsx(root as never, probeProps(name)));

			expect(css).not.toBeNull();
			expect(css).not.toContain(FINGERPRINT);
		});

		for (let [key, member] of members) {
			test(`${name}.${key} emits no stringified style block`, async () => {
				/**
				 * Tries `member` under its own root, then wrapped by each sibling in
				 * turn, since its real parent may be any one of them; the assertions
				 * below fail for a member that renders in none, keeping the sweep honest.
				 */
				let wrappers = [
					jsx(root as never, {
						...probeProps(name),
						children: jsx(member as never, probeProps(name)),
					}),
					...members
						.filter(([siblingKey]) => siblingKey !== key)
						.map(([, sibling]) =>
							jsx(root as never, {
								...probeProps(name),
								children: jsx(sibling as never, {
									...probeProps(name),
									children: jsx(member as never, probeProps(name)),
								}),
							}),
						),
				];

				let css: string | null = null;
				for (let wrapper of wrappers) {
					css = await styleOf(wrapper);
					if (css !== null) break;
				}

				expect(css).not.toBeNull();
				expect(css).not.toContain(FINGERPRINT);
			});
		}
	}
});
