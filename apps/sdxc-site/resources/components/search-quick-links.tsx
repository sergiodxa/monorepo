/**
 * The search dialog's quick links: the site's four sections, listed under an empty box so the
 * dialog doubles as the site's navigation. They fade in only after a pause, so a reader who
 * opens the dialog and types at once never sees them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { bg, fg } from "@sdxc/u/color";
import { rounded, visibility } from "@sdxc/u/effects";
import { listStyle } from "@sdxc/u/general";
import { gap, grid, gridTemplate, hidden, items } from "@sdxc/u/layout";
import { dark, light, startingStyle } from "@sdxc/u/responsive";
import { m, minIs, p } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { text, textDecoration, truncate, weight } from "@sdxc/u/typography";

import type { SearchKind } from "~/app/services/search-query";

import { SEARCH_QUICK_LINKS_ID, searchQuickLinkId } from "~/resources/components/search-box";
import { SearchKindIcon } from "~/resources/components/search-result";
import { searchSurface, searchSurfaceMotion } from "~/resources/components/search-surface";
import { SEARCH_DIALOG_INPUT_ID } from "~/resources/views/search-frame";
import routes from "~/routes/web";

/** One destination the dialog offers before anything is typed. */
interface QuickLink {
	href: string;
	label: string;
	/** A few words on what the section holds, shown under its label. */
	description: string;
	/** The kind whose icon the link leads with, the same one its results carry. */
	kind: SearchKind;
}

/** The guides, the package references, then each catalogue, as the header lists them. */
const QUICK_LINKS: ReadonlyArray<QuickLink> = [
	{
		href: routes.docs.index.href(),
		label: "Guides",
		description: "Build a Remix app on Cloudflare, step by step",
		kind: "guide",
	},
	{
		href: routes.api.index.href(),
		label: "Packages",
		description: "Every package's API reference",
		kind: "api",
	},
	{
		href: routes.api.show.href({ name: "u" }),
		label: "Utilities",
		description: "Styling mixins in @sdxc/u",
		kind: "u",
	},
	{
		href: routes.api.show.href({ name: "ui" }),
		label: "Components",
		description: "The component library in @sdxc/ui",
		kind: "ui",
	},
];

/**
 * Renders the links as the listbox the box's combobox points into while it is empty, leaving
 * out the page the reader is on. The list hides the moment the box holds text, and shows
 * again, after the same pause, once the box is cleared.
 */
export function SearchQuickLinks(handle: Handle<{ currentPath?: string }>) {
	return () => (
		<ul
			id={SEARCH_QUICK_LINKS_ID}
			// oxlint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role -- HTML allows a list to take the listbox role, which keeps the quick links a list of links without script.
			role="listbox"
			aria-label="Go to"
			mix={[
				searchSurface(),
				rounded("1.75rem"),
				m(0),
				p(2),
				listStyle("none"),
				grid(),
				gap(1),
				when(`:is(dialog:has(#${SEARCH_DIALOG_INPUT_ID}:not(:placeholder-shown))) &`, hidden()),
				searchSurfaceMotion(300),
				startingStyle(when(":is(dialog[open]) &", visibility("hidden"))),
			]}
		>
			{QUICK_LINKS.filter((link) => link.href !== handle.props.currentPath).map((link, index) => (
				<li
					key={link.href}
					id={searchQuickLinkId(index)}
					// oxlint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role -- Each item is an option of the listbox above, which the box's aria-activedescendant points at.
					role="option"
					aria-selected="false"
					mix={[
						rounded("1.25rem"),
						hover([light(bg("brand.bg-tint-hover")), dark(bg("neutral.bg-tint-hover"))]),
						when('&[aria-selected="true"]', [
							light(bg("brand.bg-tint-hover")),
							dark(bg("neutral.bg-tint-hover")),
						]),
					]}
				>
					<a
						href={link.href}
						mix={[
							grid(),
							gridTemplate({ columns: "1.5rem minmax(0, 1fr)" }),
							items("center"),
							gap(3),
							p(3),
							fg("neutral.emphasis"),
							textDecoration("none"),
						]}
					>
						<SearchKindIcon kind={link.kind} />
						<span mix={[grid(), minIs(0)]}>
							<span mix={[text("base"), weight("medium")]}>{link.label}</span>
							<span mix={[text("sm"), fg("neutral.muted"), truncate()]}>{link.description}</span>
						</span>
					</a>
				</li>
			))}
		</ul>
	);
}
