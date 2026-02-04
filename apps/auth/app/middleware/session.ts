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
