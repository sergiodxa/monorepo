import { json } from "@pkg/http/response";

import action from "~/app/lib/action";

/** Liveness probe. */
export default action<"GET", "/health">(async () => json({ status: "ok" }));
