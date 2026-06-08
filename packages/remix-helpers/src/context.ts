import type { ContextWithEntries, RequestContext } from "remix/fetch-router";

import { Auth } from "remix/auth-middleware";
import { Database } from "remix/data-table";
import { Session } from "remix/session";

/** Default context shape used by app controllers that rely on common Remix middleware. */
export type DefaultContext = ContextWithEntries<
	RequestContext<Record<string, any>>,
	[
		{ key: typeof Database; value: Database },
		{ key: typeof FormData; value: FormData },
		{ key: typeof Session; value: Session },
		{ key: typeof Auth; value: unknown },
	]
>;
