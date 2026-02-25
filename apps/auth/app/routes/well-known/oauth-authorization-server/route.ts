import { ok } from "@pkg/http/response/json";

import { WELL_KNOWN } from "~/config";

export function loader() {
	return ok(WELL_KNOWN);
}
