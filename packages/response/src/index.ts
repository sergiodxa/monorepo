import { Location } from "@pkg/location";
import { data } from "react-router";

type Init = Omit<ResponseInit, "status" | "statusText">;

export function ok<T>(input: T, init?: Init) {
	return data({ ...input, ok: true as const }, { ...init, status: 200 });
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
	return data({ ...input, ok: false as const }, { ...init, status: 400 });
}

export function unauthorized<T>(input: T, init?: Init) {
	return data({ ...input, ok: false as const }, { ...init, status: 401 });
}

export function paymentRequired<T>(input: T, init?: Init) {
	return data({ ...input, ok: false as const }, { ...init, status: 402 });
}

export function forbidden<T>(input: T, init?: Init) {
	return data({ ...input, ok: false as const }, { ...init, status: 403 });
}

export function notFound<T>(input: T, init?: Init) {
	return data({ ...input, ok: false as const }, { ...init, status: 404 });
}

export function unprocessableEntity<T>(input: T, init?: Init) {
	return data({ ...input, ok: false as const }, { ...init, status: 422 });
}
