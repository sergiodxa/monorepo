/**
 * Delivering an authorization response to a relying party in the response mode it
 * asked for: query parameters, a URL fragment, or a self-submitting form post. Every
 * path that ends an authorization request — SSO, credential sign-in, provider sign-in,
 * and the error redirects — goes through here so all three modes behave the same.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { i18n } from "@pkg/i18n";
import type { Renderer } from "remix/middleware/render";
import type { RemixNode } from "remix/ui";

import { redirect } from "@pkg/http/response";

import type { ResponseMode } from "~/app/http/middleware/session";

import FormPostView from "~/resources/views/form-post";

/**
 * Headers a form-post response carries. The page holds an authorization code, so it must
 * reach only the browser that asked for it.
 */
const NO_STORE_HEADERS = { "Cache-Control": "no-store", Pragma: "no-cache" };

/** The slice of request context this module reads. */
export interface AuthorizationResponseContext {
	render: Renderer<RemixNode>;
	i18next: i18n;
}

/**
 * Sends the authorization response parameters back to a relying party.
 *
 * In `fragment` mode the parameters are merged into whatever hash the registered redirect
 * URI already carries, since the client may route its callback on that hash.
 *
 * @param ctx - Request context, used to render the form-post page.
 * @param redirectUri - The client's registered redirect URI, already validated.
 * @param params - The response parameters, such as `code` and `state`, or an `error`.
 * @param responseMode - How the client asked to receive them; defaults to `query`.
 * @returns A redirect for `query` and `fragment`, or the form-post page.
 */
export async function authorizationResponse(
	ctx: AuthorizationResponseContext,
	redirectUri: string,
	params: Record<string, string>,
	responseMode: ResponseMode = "query",
): Promise<Response> {
	if (responseMode === "form_post") {
		return await ctx.render(
			<FormPostView
				action={redirectUri}
				params={params}
				title={ctx.i18next.t("authorize.formPost.title")}
				submitLabel={ctx.i18next.t("authorize.formPost.submit")}
				noscriptMessage={ctx.i18next.t("authorize.formPost.noscript")}
			/>,
			{ headers: NO_STORE_HEADERS },
		);
	}

	let url = new URL(redirectUri);

	if (responseMode === "fragment") {
		let fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
		for (let [key, value] of Object.entries(params)) fragment.set(key, value);
		url.hash = fragment.toString();
	} else {
		for (let [key, value] of Object.entries(params)) url.searchParams.set(key, value);
	}

	/**
	 * See Other guarantees the callback is fetched with `GET` whichever request produced
	 * this response, which matters because this same function answers the `POST` sign-in
	 * form, where a method-preserving redirect would re-POST the credentials to a client.
	 */
	return redirect(url.toString(), {
		status: redirect.Status.SeeOther,
		headers: NO_STORE_HEADERS,
	});
}
