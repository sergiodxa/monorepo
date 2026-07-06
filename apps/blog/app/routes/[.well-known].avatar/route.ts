/**
 * Route serving the site's avatar image at the /.well-known/avatar path. Its
 * loader resolves the bundled avatar.png asset against the request URL and
 * proxies it through fetch, exposing a stable well-known location for the
 * author's avatar.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Route } from "./+types/route";

import avatar from "./avatar.png";

export function loader({ request }: Route.LoaderArgs) {
	let url = new URL(avatar, request.url);
	return fetch(url);
}
