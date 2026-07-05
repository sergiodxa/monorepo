import { json } from "@pkg/http/response";
import { createAction } from "remix/fetch-router";

import routes from "~/routes/web";

/** Liveness probe. */
export default createAction(routes.health, async () => json({ status: "ok" }));
