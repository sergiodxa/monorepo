/**
 * The parts of the apps showcase that read the same in every language: where each app
 * lives, so both translations always agree on the destination a visitor opens.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import routes from "~/routes/web";

/** Where each listed app opens from the showcase. */
export const APP_LINKS = {
	wakaba: routes.wakaba.href(),
	encore: routes.encore.href(),
	uptime: "https://uptime.sergiodxa.com",
	reader: "https://reader.sergiodxa.com",
} as const;
