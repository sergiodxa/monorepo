/**
 * The navigation's search trigger: a quiet search-field-shaped pill linking to `/search`,
 * rendered as static HTML so it works the moment the page arrives. On wide screens the
 * search box island turns a plain click on it into opening the search dialog instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { SearchIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { hidden, inlineBlock, shrink } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { mis } from "@sdxc/u/size";
import { hover } from "@sdxc/u/state";
import { font, text } from "@sdxc/u/typography";

import { NavPill, WIDE_SCREEN } from "~/resources/components/nav-pill";
import { PillLabel } from "~/resources/components/pill-label";
import routes from "~/routes/web";

/** The dialog the trigger and every key open, which the layout renders with this id. */
export const SEARCH_DIALOG_ID = "site-search";

/** The attribute the trigger link carries, which the dialog's script finds it by. */
export const SEARCH_TRIGGER_ATTRIBUTE = "data-search-trigger";

/** The attribute on the trigger's shortcut hint, which script reprints for a non-Apple keyboard. */
export const SEARCH_SHORTCUT_ATTRIBUTE = "data-search-shortcut";

/**
 * Renders the search link as one of the header's pills: round with the magnifier alone on a
 * narrow screen, and "Search" with the ⌘K hint on a wide one. It names itself "Search" and its
 * shortcuts in `aria-keyshortcuts`; the hint is decoration, trimmed so it never grows the pill.
 */
export function SearchTrigger(handle: Handle<{ mix?: TagProps<"a">["mix"] }>) {
	return () => (
		<NavPill
			href={routes.search.href()}
			{...{ [SEARCH_TRIGGER_ATTRIBUTE]: "" }}
			shape="round"
			aria-label="Search"
			aria-keyshortcuts="Meta+K Control+K /"
			mix={[fg("neutral.muted"), hover(fg("neutral.emphasis")), handle.props.mix]}
		>
			<SearchIcon size="1em" mix={[shrink(0)]} />
			<PillLabel mix={[hidden(), media(WIDE_SCREEN, inlineBlock())]}>Search</PillLabel>
			<kbd
				aria-hidden="true"
				{...{ [SEARCH_SHORTCUT_ATTRIBUTE]: "" }}
				mix={[
					hidden(),
					media(WIDE_SCREEN, inlineBlock()),
					media("(hover: none)", hidden()),
					mis(2),
					font("sans"),
					text("xs"),
					fg("neutral.muted"),
				]}
			>
				<PillLabel>⌘K</PillLabel>
			</kbd>
		</NavPill>
	);
}
