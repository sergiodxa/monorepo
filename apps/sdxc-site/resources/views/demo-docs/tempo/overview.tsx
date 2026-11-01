/**
 * Tempo's overview pages: installing the library and choosing an import path, and the
 * concept page on time zones that every reference page's behaviour rests on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DemoDocsPage } from "~/resources/views/demo-docs";

import { demoDocsHref } from "~/resources/views/demo-docs";
import { Aside, Code, Fields, Heading, Install } from "~/resources/views/demo-docs/blocks";

/** The addresses of Tempo's pages. */
const href = demoDocsHref("tempo");

/** Installation: the install line, the import paths, and the runtime requirements. */
export const INSTALLATION: DemoDocsPage = {
	title: "Installation",
	description:
		"Add Tempo to a project, import from the root or from one module, and check which runtimes it supports.",
	updated: "2026-10-28",
	toc: [
		{ id: "install", text: "Install", level: 2 },
		{ id: "import-paths", text: "Import paths", level: 2 },
		{ id: "runtimes", text: "Supported runtimes", level: 2 },
	],
	next: [
		{
			title: "Arithmetic",
			href: href("reference/arithmetic"),
			description: "Add days, months and business days.",
		},
		{
			title: "Time zones",
			href: href("overview/time-zones"),
			description: "How Tempo decides which zone a date is in.",
		},
	],
	render: (request) => (
		<>
			<p>
				Tempo is a set of small functions over the built-in <code>Date</code>. It has no
				dependencies and adds about 1 KB per function you import.
			</p>

			<Heading id="install">Install</Heading>
			<Install packages={["@tempo/core"]} selected={request.tab("package-manager")} />

			<Heading id="import-paths">Import paths</Heading>
			<p>
				Import from the root while you explore, or from a module to make it plain which part of the
				library a file uses. Both shake to the same bundle.
			</p>
			<Code
				title="app/services/schedule.ts"
				language="ts"
				code={
					'import { addBusinessDays, format } from "@tempo/core";\nimport { eachDay } from "@tempo/core/ranges";'
				}
			/>
			<Fields
				label="Import paths"
				rows={[
					{ name: "@tempo/core", type: "module", description: "Every function." },
					{
						name: "@tempo/core/arithmetic",
						type: "module",
						description: "addDays, addMonths, addBusinessDays, subtract, difference, clamp.",
					},
					{
						name: "@tempo/core/comparison",
						type: "module",
						description: "isBefore, isAfter, isSame, isWithin, max, min.",
					},
					{
						name: "@tempo/core/format",
						type: "module",
						description: "format, formatRelative, formatDuration, parse.",
					},
					{
						name: "@tempo/core/ranges",
						type: "module",
						description: "eachDay, eachWeek, overlaps.",
					},
				]}
			/>

			<Heading id="runtimes">Supported runtimes</Heading>
			<p>
				Tempo runs anywhere with <code>Intl.DateTimeFormat</code> and time zone data: Node.js 20+,
				Bun, Deno, Cloudflare Workers and every current browser.
			</p>
			<Aside kind="note">
				Some minimal Linux images ship Node.js without full ICU. Formatting in those falls back to
				English; install the <code>full-icu</code> build to get every locale.
			</Aside>
		</>
	),
};

/** Time zones: instants versus wall-clock time, and how each function treats them. */
export const TIME_ZONES: DemoDocsPage = {
	title: "Time zones",
	description:
		"How Tempo tells an instant from a wall-clock time, which zone each function works in, and how to pick one.",
	updated: "2026-10-15",
	toc: [
		{ id: "instants-and-wall-time", text: "Instants and wall-clock time", level: 2 },
		{ id: "which-zone", text: "Which zone a function uses", level: 2 },
		{ id: "pick-a-zone", text: "Pick a zone", level: 2 },
		{ id: "daylight-saving", text: "Daylight saving changes", level: 2 },
	],
	next: [
		{
			title: "Arithmetic",
			href: href("reference/arithmetic"),
			description: "See calendar-aware adding across a DST change.",
		},
		{
			title: "Formatting",
			href: href("reference/formatting"),
			description: "Write a date in the reader’s zone.",
		},
	],
	render: () => (
		<>
			<p>
				A <code>Date</code> is an instant: one moment, the same everywhere. What a person reads as
				“9:00 on Monday” is a wall-clock time, which names a different instant in every zone. Tempo
				keeps the two apart.
			</p>

			<Heading id="instants-and-wall-time">Instants and wall-clock time</Heading>
			<p>
				Comparisons work on instants, so <code>isBefore</code> means the same thing in Tokyo and
				Lima. Calendar arithmetic works on wall-clock time, because “tomorrow at 9:00” is a
				wall-clock idea.
			</p>

			<Heading id="which-zone">Which zone a function uses</Heading>
			<p>
				A function that reads calendar parts uses the runtime’s zone unless you pass{" "}
				<code>timeZone</code>. On a server that’s usually UTC, which is rarely your reader’s.
			</p>

			<Heading id="pick-a-zone">Pick a zone</Heading>
			<Code
				title="app/services/reminders.ts"
				language="ts"
				highlight={[3]}
				code={
					'import { format } from "@tempo/core";\n\nlet zone = user.timeZone;\nformat(reminder.dueAt, "datetime", { timeZone: zone });\n// "Nov 1, 2026, 9:00 AM" in the reader’s own zone'
				}
			/>
			<Aside kind="tip">
				Store the reader’s IANA zone name, such as <code>America/Mexico_City</code>, not an offset.
				An offset changes twice a year in many places; the name doesn’t.
			</Aside>

			<Heading id="daylight-saving">Daylight saving changes</Heading>
			<p>
				Adding a day across a change keeps the wall-clock time, so the result is 23 or 25 hours
				later. Subtracting <code>{"{ hours: 24 }"}</code> moves exactly 24 hours instead. Pick the
				one your feature means.
			</p>
		</>
	),
};
