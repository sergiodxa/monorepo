/**
 * Serves the frames every blog-layout page embeds, for a test router that maps only the
 * routes under test. The renderer inlines each `<Frame>` from the router and requires an
 * HTML answer, so a page wearing the layout needs its search dialog's frame mapped.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import { SearchViewModel } from "~/app/http/view-models/search";
import { SearchFrameView } from "~/resources/views/search-frame";
import routes from "~/routes/web";

/**
 * Answers the search dialog's frame with its blank box, the state a page renders it in when
 * the visitor has typed nothing. Needs the app's HTML renderer on the router.
 */
export const blankSearchFrame = createAction(routes.searchFrame, (ctx) =>
	ctx.render(SearchFrameView, SearchViewModel.blank()),
);
