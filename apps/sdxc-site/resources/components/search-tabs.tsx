/**
 * The search dialog's kind tabs: a row of chips over the matches, "All" then each kind that
 * holds any, with its count. Each chip links to `/search` narrowed to its kind, which the
 * search box island turns into reloading the dialog's own results instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { bg, colorMix, fg } from "@sdxc/u/color";
import { opacity, rounded, transition } from "@sdxc/u/effects";
import { listStyle } from "@sdxc/u/general";
import { flex, gap, inlineFlex, items, shrink } from "@sdxc/u/layout";
import { overflowX } from "@sdxc/u/overflow";
import { startingStyle } from "@sdxc/u/responsive";
import { bs, m, minBs, p, pi } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { translateProperty } from "@sdxc/u/transform";
import { nowrap, text, textDecoration } from "@sdxc/u/typography";

import type { SearchResults } from "~/app/services/search-results";

import { SEARCH_KIND_ATTRIBUTE } from "~/resources/components/search-box";

/**
 * Renders the tabs. The current one carries `aria-current`, the only mark of which kind the
 * rows below belong to; the row scrolls sideways on a screen too narrow for every chip.
 */
export function SearchTabs(handle: Handle<{ tabs: Array<SearchResults.Tab> }>) {
	return () => (
		<ul
			aria-label="Narrow by kind"
			mix={[
				m(0),
				p(0),
				pi(1),
				listStyle("none"),
				flex(),
				gap(2),
				overflowX("auto"),
				/** Scrolling sideways drops the strip's automatic minimum, so a full card would squeeze it to nothing. */
				minBs(8),
				transition("opacity, translate", { duration: 200 }),
				startingStyle([opacity(0), translateProperty("0 -0.25rem")]),
			]}
		>
			{handle.props.tabs.map((tab) => (
				<li key={tab.kind ?? "all"} mix={[shrink(0)]}>
					<a
						href={tab.href}
						{...{ [SEARCH_KIND_ATTRIBUTE]: tab.kind ?? "" }}
						aria-current={tab.current ? "true" : undefined}
						mix={[
							inlineFlex(),
							items("center"),
							gap(2),
							bs(8),
							pi(3),
							rounded("full"),
							nowrap(),
							text("sm"),
							textDecoration("none"),
							fg("neutral.muted"),
							bg(colorMix("oklab", { color: "currentColor", weight: 6 }, "transparent")),
							hover([
								fg("neutral.emphasis"),
								bg(colorMix("oklab", { color: "currentColor", weight: 10 }, "transparent")),
							]),
							when('&[aria-current="true"]', [
								fg("neutral.emphasis"),
								bg(colorMix("oklab", { color: "currentColor", weight: 14 }, "transparent")),
							]),
						]}
					>
						{tab.label}
						<span mix={[fg("neutral.muted"), text("xs")]}>{tab.count}</span>
					</a>
				</li>
			))}
		</ul>
	);
}
