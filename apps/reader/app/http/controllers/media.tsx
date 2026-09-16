/**
 * Media controller for `GET /media/:signature/:source`: the one place a publisher's image
 * is fetched, and the reason a reader's browser makes no request to any host but this one.
 *
 * The request that goes out carries no cookie, no referrer and a user agent naming this
 * product, so a publisher learns that one server asked for a picture and nothing about who
 * was reading. That substitution is the whole benefit here; every bound below — the
 * signature, the scheme, port and address checks on every hop, the size cap and the type
 * allow-list — is the cost of being allowed to make it.
 *
 * Answers are held at the edge and nowhere else. Keeping a copy of the internet's images in
 * a store of this app's own would cost a hundred times the fetch it saves, so a second
 * reader of the same article pays a cache read at the colo they are already talking to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { currentLog } from "@sdxc/logger";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import {
	hostOf,
	MEDIA_CACHE,
	MEDIA_CACHE_CONTROL,
	readWithin,
	retrieveImage,
	servedType,
	verifiedSource,
} from "~/app/lib/media";
import routes from "~/routes/web";

/** The signed pair the address carries, which is the whole of what this route reads. */
const Params = s.object({ signature: s.string(), source: s.string() });

/** The answer to an address this app did not mint, and to one it will not retrieve. */
const REFUSED_STATUS = 403;

/** The answer when the publisher's server produced no image this app is willing to serve. */
const UNAVAILABLE_STATUS = 502;

/** What every answer from here carries, whatever it carries beside it. */
function mediaHeaders(type: string): Headers {
	let headers = new Headers();
	headers.set("content-type", type);
	headers.set("cache-control", MEDIA_CACHE_CONTROL);
	headers.set("x-content-type-options", "nosniff");
	headers.set("cross-origin-resource-policy", "same-origin");
	return headers;
}

/**
 * GET /media/:signature/:source — one remote image, fetched here and handed on.
 *
 * Nothing about the reader reaches the log: the event names the image's host, which
 * identifies a CDN, rather than its URL, which would identify the article they opened.
 */
export default createAction(routes.media, {
	async handler(ctx) {
		let { signature, source } = s.parse(Params, ctx.params);
		let startedAt = Date.now();
		let log = currentLog();

		let url = await verifiedSource(signature, source);
		if (url === null) return new Response(null, { status: REFUSED_STATUS });

		let host = hostOf(url);

		let cache = await caches.open(MEDIA_CACHE);
		let cached = await cache.match(ctx.request);
		if (cached) {
			log?.note("media.proxy", {
				host,
				status: cached.status,
				cacheHit: true,
				bytes: 0,
				durationMs: Date.now() - startedAt,
			});

			return cached;
		}

		let response = await retrieveImage(url);

		if (response === null || !response.ok) {
			log?.note("media.proxy", {
				host,
				status: response?.status ?? 0,
				cacheHit: false,
				bytes: 0,
				durationMs: Date.now() - startedAt,
			});

			return new Response(null, {
				status: response === null ? REFUSED_STATUS : UNAVAILABLE_STATUS,
			});
		}

		let type = servedType(response);
		let bytes = type === null ? null : await readWithin(response.body);

		if (type === null || bytes === null) {
			log?.note("media.proxy", {
				host,
				status: response.status,
				cacheHit: false,
				bytes: 0,
				durationMs: Date.now() - startedAt,
			});

			return new Response(null, { status: UNAVAILABLE_STATUS });
		}

		log?.note("media.proxy", {
			host,
			status: response.status,
			cacheHit: false,
			bytes: bytes.byteLength,
			durationMs: Date.now() - startedAt,
		});

		let answer = new Response(bytes, { headers: mediaHeaders(type) });

		/**
		 * Written to the edge before the reader is answered, so the second reader of the same
		 * article finds it there. A cache this app cannot reach costs a fetch and nothing else.
		 */
		await cache.put(ctx.request, answer.clone());

		return answer;
	},
});
