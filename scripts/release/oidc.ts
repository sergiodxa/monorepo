/**
 * The trusted-publisher check a CI run makes before it builds anything. npm publishes through
 * OIDC by exchanging the job's GitHub identity token for a short-lived npm token, one package at
 * a time; performing that same exchange for every member up front names each package whose
 * npmjs.com entry is missing or mismatched before any sibling ships.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success, wrap } from "@sdxc/result";

import { TRUSTED_PUBLISHER } from "./workspace.js";

/** The audience npm's registry expects in the GitHub identity token it exchanges. */
const AUDIENCE = "npm:registry.npmjs.org";

/** The registry endpoint that trades a GitHub identity token for a publish token, per package. */
const EXCHANGE_URL = "https://registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/";

/** Whether this process runs inside a GitHub Actions job, where OIDC is the publish credential. */
export function inGitHubActions(): boolean {
	return process.env.GITHUB_ACTIONS === "true";
}

/**
 * Confirms npm accepts this workflow as the publisher of every `name`, and lists every refusal
 * with the registry's reason. Outside GitHub Actions the operator's own session publishes, so
 * the check passes without a request.
 */
export async function preflightTrustedPublishers(names: string[]): Promise<Result<void, Error>> {
	if (!inGitHubActions()) return success(undefined);
	let idToken = await githubIdToken();
	if (isFailure(idToken)) return idToken;
	let outcomes = await Promise.all(
		names.map(async (name) => [name, await exchangeForPackage(name, idToken.data)] as const),
	);
	let refusals = outcomes
		.filter(([, outcome]) => isFailure(outcome))
		.map(([name, outcome]) => `${name}: ${isFailure(outcome) ? outcome.error.message : ""}`);
	if (refusals.length > 0) {
		return failure(
			new Error(
				`npm did not accept this workflow as the publisher of every package; check each trusted publisher on npmjs.com (${TRUSTED_PUBLISHER}):\n${refusals.join("\n")}`,
			),
		);
	}
	return success(undefined);
}

/**
 * The job's GitHub identity token for npm's audience. GitHub exposes the request URL and its
 * bearer token to a job only when it holds `permissions: id-token: write`.
 */
export async function githubIdToken(): Promise<Result<string, Error>> {
	let requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL ?? "";
	let requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN ?? "";
	if (requestUrl === "" || requestToken === "") {
		return failure(
			new Error("GitHub issued no identity token; the job needs `permissions: id-token: write`"),
		);
	}
	let url = wrap(() => new URL(requestUrl));
	if (isFailure(url)) return url;
	url.data.searchParams.append("audience", AUDIENCE);
	let body = await requestJson(url.data.href, {
		headers: { Authorization: `Bearer ${requestToken}`, Accept: "application/json" },
	});
	if (isFailure(body)) return body;
	let value = isRecord(body.data) ? body.data.value : undefined;
	if (typeof value !== "string" || value === "") {
		return failure(new Error("GitHub answered the identity token request without a token"));
	}
	return success(value);
}

/**
 * The exchange npm performs before a publish: a match on the package's trusted publisher
 * answers with a token, which this check discards; any other answer is the refusal, with the
 * registry's own message.
 */
export async function exchangeForPackage(
	name: string,
	idToken: string,
): Promise<Result<void, Error>> {
	let body = await requestJson(`${EXCHANGE_URL}${name.replace("/", "%2F")}`, {
		method: "POST",
		headers: { Authorization: `Bearer ${idToken}`, Accept: "application/json" },
	});
	if (isFailure(body)) return body;
	let token = isRecord(body.data) ? body.data.token : undefined;
	if (typeof token !== "string" || token === "") {
		return failure(new Error("the registry answered the exchange without a token"));
	}
	return success(undefined);
}

/**
 * The JSON a 2xx answer carries; any other status is a failure quoting the `message` in the
 * response body when there is one, since that is where the registry explains a refusal.
 */
async function requestJson(url: string, init: RequestInit): Promise<Result<unknown, Error>> {
	let response = await wrap(() => fetch(url, init));
	if (isFailure(response)) return response;
	let json = await wrap(() => response.data.json());
	if (response.data.ok) return json;
	let message =
		!isFailure(json) && isRecord(json.data) && typeof json.data.message === "string"
			? json.data.message
			: response.data.statusText;
	return failure(new Error(`${response.data.status} ${message}`.trim()));
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
