import oidc from "~/services/oidc";

export async function loader() {
	return Response.json(await oidc.jwks);
}
