/**
 * The Foundations of `@sdxc/ui/docs`: what the docs shell and blocks are for, the reading,
 * heading and island rules they share, and each variable the namespace reads, with the
 * default its components fall back to or the prop that writes it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Foundations } from "~/resources/content/foundations";

const DOCS: Foundations = {
	module: "docs",
	slug: "docs-foundations",
	title: "Docs foundations",
	summary:
		"What @sdxc/ui/docs is for, the reading, heading and island rules its parts share, and every variable it reads.",
	importPath: "@sdxc/ui/docs",
	source: "ui/src/docs/docs-layout.tsx",
	intro: [
		"A documentation site's shell and the blocks around its prose: sidebar, On this page rail, page header, code, steps, callouts, props tables, pager, hub and a 404 that searches.",
		"Pages are server HTML; a few small islands add copying, sidebar filtering, the rail's marker and synced tabs.",
	],
	reachFor: [
		"A guide, tutorial or reference site for developers, such as a library's docs or an API reference.",
		"Product help docs: task pages, troubleshooting and a hub that routes a reader by what they want to do.",
		"Any long-form page read in a sidebar-and-article shell rather than as a landing.",
	],
	ideas: [
		{
			title: "Two measures",
			body: "Prose stops at `proseMeasure` (66ch); code, tables and images fill `measure` (64rem).",
		},
		{
			title: "Reading type",
			body: 'Wrap prose in `<Typeset preset="docs">`: 18px on a 1.75 line. Opt a block out with `data-not-typeset`.',
		},
		{
			title: "Heading levels",
			body: "`DocsPageHeader` renders the one `h1`; `AnchorHeading` and `Steps` follow the ambient `HeadingScope`.",
		},
		{
			title: "One tree",
			body: "A `DocsTree` feeds `DocsNav`, `DocsPager` and search, so adding a page is one edit.",
		},
		{
			title: "Layout",
			body: "The sidebar docks from `dock` (48rem or 64rem) and the rail shows from 75rem; narrower, they become a drawer and a sticky bar.",
		},
		{
			title: "Motion",
			body: "Only state changes animate, 150–300ms, and they stop under `prefers-reduced-motion`.",
		},
		{
			title: "Accessibility",
			body: "`DocsNav` marks `aria-current`, copy buttons announce through a status region, and `CodeTabs` is a radio group.",
		},
		{
			title: "Islands",
			body: "Map `table-of-contents`, `docs-nav-tools`, `copy-button`, `code-tabs-sync` and `page-actions` from `@sdxc/ui/docs/*`.",
		},
	],
	roles:
		"Reads the neutral and brand roles, plus success, warning and danger for Callout kinds, diff lines and required props.",
	variables: [
		{
			title: "Reading and scrolling",
			lead: "The docs variables are set through `DocsLayout`'s props and `Typeset`'s preset; override one on a single block where it needs a different value.",
			variables: [
				{
					name: "--ui-docs-prose-measure",
					default: "set by DocsLayout from proseMeasure (66ch)",
					controls:
						"Widest line of running text; paragraphs, lists, headings and callouts stop at it.",
				},
				{
					name: "--ui-docs-scroll-margin",
					default: "5rem; DocsLayout sets it from stickyTop",
					controls: "Space a jumped-to heading leaves above itself to clear the sticky chrome.",
				},
				{
					name: "--ui-typeset-size",
					default: "1.125rem in the docs preset",
					controls: "Body size; prose headings scale from it.",
				},
				{
					name: "--ui-typeset-leading",
					default: "1.75 in the docs preset",
					controls: "Line height of running text.",
				},
				{
					name: "--ui-typeset-flow",
					default: "1.25em in the docs preset",
					controls: "Space between blocks of prose.",
				},
				{
					name: "--highlight-<token>",
					default: "a light-dark() pair per token, such as #6a737d / #8b949e for comment",
					controls:
						"Color of one syntax token in `CodeBlock`: keyword, string, comment and the rest.",
				},
			],
		},
		{
			title: "Shape and elevation",
			lead: "Read through `@sdxc/u`'s `rounded()` and `shadow()`; `theme.css` declares none of them, so each default is the fallback an app overrides by declaring the variable.",
			variables: [
				{
					name: "--ui-radius-sm",
					default: "0.25rem",
					controls: "Corners of `AnchorHeading`'s link and `FileTree` rows.",
				},
				{
					name: "--ui-radius-md",
					default: "0.375rem",
					controls: "Corners of `Callout`, `PlanNotice`, `CopyButton` and `PageActions`.",
				},
				{
					name: "--ui-radius-lg",
					default: "0.5rem",
					controls:
						"Corners of `CodeBlock`, `FileTree`, sidebar groups and hub, pager and next-step cards.",
				},
				{
					name: "--ui-radius-full",
					default: "9999px",
					controls: "Pills: the rail's marker, step numbers, feedback buttons and hub chips.",
				},
				{
					name: "--ui-shadow-float",
					default: "none",
					controls: "Elevation of the sticky bar's heading list.",
				},
			],
		},
		{
			title: "Set by the components",
			lead: "Written by `DocsLayout`, the tocSpy mixin, `Typeset` or `PageActions` and read back by their own parts. Leave them unset.",
			variables: [
				{
					name: "--docs-sticky-top",
					default: "set by DocsLayout from stickyTop (0px)",
					controls: "Where the sidebar, bar and rail stick.",
				},
				{
					name: "--docs-gutter",
					default: "1rem, 1.5rem from 48rem, 2rem from 64rem",
					controls: "Inline padding of the shell, which the sticky bar bleeds through.",
				},
				{
					name: "--toc-marker-start, --toc-marker-size",
					default: "0px, written by tocSpy()",
					controls: "Offset and length of the marker over the sections on screen.",
				},
				{
					name: "--toc-progress",
					default: "0, written by tocSpy()",
					controls: "How full the sticky bar's progress ring is.",
				},
				{
					name: "--ui-typeset-table-fade-direction",
					default: "right; left in right-to-left text",
					controls: "Side a wide table's scroll fade sits on.",
				},
				{
					name: "--ui-button-radius",
					default: "set by PageActions",
					controls: "Squares the inner corners of the split Copy page button.",
				},
			],
		},
	],
};

export default DOCS;
