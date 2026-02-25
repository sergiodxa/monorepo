import { ok } from "@pkg/http/response/json";

import oidc from "~/services/oidc";

export async function loader() {
	return ok(await oidc.jwks);
}
