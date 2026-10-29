/**
 * The header's search trigger: a button-shaped link to `/search`, rendered as static HTML so
 * it works the moment the page arrives. The search box island turns a plain click on it into
 * opening the search dialog instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { SearchIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { Keyboard, LinkButton } from "@sdxc/ui";
import { keyComboGlyphs } from "@sdxc/ui/utils";

import routes from "~/routes/web";

/** The dialog the trigger and every key open, which the header renders with this id. */
export const SEARCH_DIALOG_ID = "site-search";

/** The attribute the trigger link carries, which the dialog's script finds it by. */
export const SEARCH_TRIGGER_ATTRIBUTE = "data-search-trigger";

/**
 * Renders the search link, naming its shortcuts in `aria-keyshortcuts`; the hint prints the
 * reader's own modifier, which the server reads from the platform it was asked from.
 */
export function SearchTrigger(handle: Handle<{ appleKeyboard: boolean }>) {
	return () => (
		<LinkButton
			href={routes.search.href()}
			{...{ [SEARCH_TRIGGER_ATTRIBUTE]: "" }}
			color="neutral"
			variant="outline"
			size="sm"
			aria-keyshortcuts="Meta+K Control+K /"
		>
			<SearchIcon size={16} aria-hidden="true" />
			Search
			<Keyboard mix={[fg("inherit")]}>
				{keyComboGlyphs("mod+k", handle.props.appleKeyboard).join("")}
			</Keyboard>
		</LinkButton>
	);
}
