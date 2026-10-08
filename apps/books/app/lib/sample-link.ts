/**
 * The signed, short-lived link to the sample chapter's EPUB. The unlocked chapter page is the
 * only place one is minted, so the file stays behind the same email gate as the chapter while
 * the app keeps no session: the link carries its own expiry and an HMAC over it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { Hex, hmac } from "@sdxc/crypto";
import { failure, isFailure, success } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";

import routes from "~/routes/web";

/**
 * One hour: long enough to finish reading the chapter and then download it, short enough
 * that a link pasted somewhere public stops working the same day. An expired link sends the
 * reader back to the form, where the address mints a fresh one.
 */
export const SAMPLE_LINK_TTL_SECONDS = 60 * 60;

/**
 * Prefixes the signed payload, so a MAC made for this link verifies for nothing else the
 * secret might ever sign.
 */
const PURPOSE = "books.sample-epub.v1";

/** The query a download link carries, as the download route receives it. */
const SampleLinkQuery = s.object({
	expires: s.string(),
	signature: s.string(),
});

/** A download link the route refuses, with the reason it logs before answering with the form. */
export class SampleLinkError extends Error {
	override name = "SampleLinkError";

	/** @param problem - `malformed` query, `expired` link, or a `forged` signature */
	constructor(readonly problem: "malformed" | "expired" | "forged") {
		super(`The sample link is ${problem}`);
	}
}

/**
 * Mints a download link valid for {@link SAMPLE_LINK_TTL_SECONDS} from `now`.
 *
 * @param now - The moment the link is minted; tests pass a fixed one.
 * @returns The path and query of the link, or the signing failure.
 * @example await signSampleLink() // "/sample/download?expires=…&signature=…"
 */
export async function signSampleLink(now = new Date()): Promise<Result<string, Error>> {
	let expires = Math.floor(now.getTime() / 1000) + SAMPLE_LINK_TTL_SECONDS;
	let signature = await hmac.sign(env.SAMPLE_LINK_SECRET, payload(expires));
	if (isFailure(signature)) return signature;

	let query = new URLSearchParams({
		expires: String(expires),
		signature: Hex.encode(signature.data),
	});
	return success(`${routes.sampleDownload.href()}?${query}`);
}

/**
 * Checks a download link's query: well-formed, unexpired at `now`, and signed with this
 * app's secret. The MAC is compared in constant time.
 *
 * @param query - The request's search params.
 * @param now - The moment of the request; tests pass a fixed one.
 * @returns Success when the link may download the file, or the reason it may not.
 */
export async function verifySampleLink(
	query: URLSearchParams,
	now = new Date(),
): Promise<Result<void, SampleLinkError>> {
	let parsed = await validate(Object.fromEntries(query), SampleLinkQuery);
	if (isFailure(parsed) || !/^\d{1,12}$/.test(parsed.data.expires))
		return failure(new SampleLinkError("malformed"));

	let expires = Number(parsed.data.expires);
	if (expires * 1000 <= now.getTime()) return failure(new SampleLinkError("expired"));

	let valid = await hmac.verify(env.SAMPLE_LINK_SECRET, payload(expires), parsed.data.signature);
	if (isFailure(valid) || !valid.data) return failure(new SampleLinkError("forged"));
	return success(undefined);
}

/** The bytes the MAC covers: the purpose and the expiry, so neither can be swapped. */
function payload(expires: number): string {
	return `${PURPOSE}:${expires}`;
}
