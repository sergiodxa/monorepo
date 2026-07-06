/**
 * Session middleware for the auth app. Wraps the KV-backed session storage in a
 * middleware that only re-commits the cookie when the session data actually
 * changes (using a deep equality check) and exposes a `session()` accessor to
 * read the current session from the request context.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { dequal } from "dequal";
import { createSessionMiddleware } from "remix-utils/middleware/session";

import { getContext } from "~/middleware/context-storage";
import { sessionStorage } from "~/session";

const [sessionMiddleware, getSessionFromContext] = createSessionMiddleware(
	sessionStorage,
	(prev, next) => !dequal(prev, next),
);

export function session() {
	let context = getContext();
	return getSessionFromContext(context);
}

export { sessionMiddleware };
