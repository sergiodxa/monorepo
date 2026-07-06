/**
 * Legacy feed route at /atom.xml that permanently forwards clients to the
 * current /rss feed via a document redirect. It preserves old Atom subscriber
 * URLs so existing feed readers keep working after the feed consolidated on the
 * RSS endpoint.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { href, redirectDocument } from "react-router";

export function loader() {
	return redirectDocument(href("/rss"));
}
