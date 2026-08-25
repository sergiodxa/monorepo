/**
 * HTTP response helpers covering JSON bodies for the common success and
 * error status codes, plus a typed redirect helper.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Location } from "@pkg/location";

type Init = Omit<ResponseInit, "status" | "statusText">;

export function ok<T>(input: T, init?: Init) {
	return Response.json({ ...input, ok: true as const }, { ...init, status: 200 });
}

export function created<T>(input: T, init?: Init) {
	return Response.json({ ...input, ok: true as const }, { ...init, status: 201 });
}

export function accepted<T>(input: T, init?: Init) {
	return Response.json({ ...input, ok: true as const }, { ...init, status: 202 });
}

export function noContent(init?: Init) {
	return new Response(null, { ...init, status: 204 });
}

export function redirect(target: URL | Location | string, init?: redirect.Init) {
	if (Location.canParse(target)) {
		let headers = new Headers(init?.headers);
		headers.set("Location", target.toString());
		return new Response(null, {
			...init,
			status: init?.status ?? redirect.Status.Temporary,
			headers,
		});
	}
	throw new Error("Invalid redirect target");
}

export namespace redirect {
	export enum Status {
		/** Always changes request method to GET. Use for POST-Redirect-GET pattern. */
		SeeOther = 303,
		/** Temporary redirect that preserves HTTP method (POST stays POST). */
		Temporary = 307,
		/** Permanent redirect that preserves HTTP method. */
		Permanent = 308,
	}

	export type Init = Omit<ResponseInit, "status" | "statusText"> & {
		status?: Status;
	};
}

export function badRequest<T>(input: T, init?: Init) {
	return Response.json({ ...input, ok: false as const }, { ...init, status: 400 });
}

export function unauthorized<T>(input: T, init?: Init) {
	return Response.json({ ...input, ok: false as const }, { ...init, status: 401 });
}

export function paymentRequired<T>(input: T, init?: Init) {
	return Response.json({ ...input, ok: false as const }, { ...init, status: 402 });
}

export function forbidden<T>(input: T, init?: Init) {
	return Response.json({ ...input, ok: false as const }, { ...init, status: 403 });
}

export function notFound<T>(input: T, init?: Init) {
	return Response.json({ ...input, ok: false as const }, { ...init, status: 404 });
}

export function methodNotAllowed<T>(input: T, init?: Init) {
	return Response.json({ ...input, ok: false as const }, { ...init, status: 405 });
}

export function notAcceptable<T>(input: T, init?: Init) {
	return Response.json({ ...input, ok: false as const }, { ...init, status: 406 });
}

export function conflict<T>(input: T, init?: Init) {
	return Response.json({ ...input, ok: false as const }, { ...init, status: 409 });
}

export function gone<T>(input: T, init?: Init) {
	return Response.json({ ...input, ok: false as const }, { ...init, status: 410 });
}

export function preconditionFailed<T>(input: T, init?: Init) {
	return Response.json({ ...input, ok: false as const }, { ...init, status: 412 });
}

export function requestEntityTooLarge<T>(input: T, init?: Init) {
	return Response.json({ ...input, ok: false as const }, { ...init, status: 413 });
}

export function unsupportedMediaType<T>(input: T, init?: Init) {
	return Response.json({ ...input, ok: false as const }, { ...init, status: 415 });
}

export function unprocessableEntity<T>(input: T, init?: Init) {
	return Response.json({ ...input, ok: false as const }, { ...init, status: 422 });
}

export function tooManyRequests<T>(input: T, init?: Init) {
	return Response.json({ ...input, ok: false as const }, { ...init, status: 429 });
}

export function internalServerError<T>(input: T, init?: Init) {
	return Response.json({ ...input, ok: false as const }, { ...init, status: 500 });
}

export function notImplemented<T>(input: T, init?: Init) {
	return Response.json({ ...input, ok: false as const }, { ...init, status: 501 });
}

export function badGateway<T>(input: T, init?: Init) {
	return Response.json({ ...input, ok: false as const }, { ...init, status: 502 });
}

export function serviceUnavailable<T>(input: T, init?: Init) {
	return Response.json({ ...input, ok: false as const }, { ...init, status: 503 });
}

export function gatewayTimeout<T>(input: T, init?: Init) {
	return Response.json({ ...input, ok: false as const }, { ...init, status: 504 });
}
