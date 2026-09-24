/**
 * Base class for clients of a remote HTTP API.
 *
 * Subclasses get path-relative requests against a fixed origin and one shared place —
 * the `before` and `after` hooks — to attach whatever every call needs: credentials,
 * a retry decision. Every request carries the running invocation's W3C trace by default.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TraceContext } from "@sdxc/trace-context";

import { currentTrace, inject } from "@sdxc/trace-context";

/** Request options a verb method accepts, minus the method it sets itself. */
export type APIClientInit = Omit<RequestInit, "method">;

/**
 * An HTTP client bound to one origin.
 *
 * @example
 * class GitHub extends APIClient {
 * 	constructor(private token: string) {
 * 		super(new URL("https://api.github.com"));
 * 	}
 *
 * 	protected override async before(request: Request): Promise<Request> {
 * 		request.headers.set("Authorization", `Bearer ${this.token}`);
 * 		return request;
 * 	}
 * }
 */
export class APIClient {
	/** Origin every path is resolved against. */
	protected readonly baseURL: URL;

	/**
	 * Which trace headers every request carries. A subclass talking to a service that should
	 * not learn the caller's upstream vendor state narrows it to `"traceparent"`, and one that
	 * should see no trace at all to `"none"`.
	 * @default "all"
	 */
	protected readonly propagateTrace: TraceContext.Propagation = "all";

	/** @param baseURL Origin to resolve request paths against. */
	constructor(baseURL: URL) {
		this.baseURL = baseURL;
	}

	/**
	 * Adjusts a request before it is sent.
	 *
	 * The extension point for anything every call needs, so a subclass can set it once
	 * here for every request. Returns the request unchanged by default.
	 *
	 * @param request Request about to be sent.
	 * @returns The request to send.
	 */
	protected async before(request: Request): Promise<Request> {
		return request;
	}

	/**
	 * Inspects a response before it reaches the caller.
	 *
	 * Receives the request too, since deciding what a response means usually needs to know
	 * what was asked. Returns the response unchanged by default.
	 *
	 * @param _request Request that produced the response.
	 * @param response Response as received.
	 * @returns The response to hand back.
	 */
	protected async after(_request: Request, response: Response): Promise<Response> {
		return response;
	}

	/**
	 * Sends a request to a path relative to {@link APIClient.baseURL}. The running
	 * invocation's trace is written into it before {@link APIClient.before} runs, so a
	 * subclass can read or replace those headers, and a `traceparent` in `init` is kept.
	 *
	 * @param path Path to request, resolved against the base URL.
	 * @param init Request options.
	 * @returns The response, after {@link APIClient.after} has seen it.
	 */
	async fetch(path: string, init?: RequestInit): Promise<Response> {
		let request = new Request(new URL(path, this.baseURL), init);
		inject(request.headers, currentTrace(), this.propagateTrace);
		request = await this.before(request);
		return await this.after(request, await fetch(request));
	}

	/**
	 * Sends a `GET` request.
	 * @param path Path to request, resolved against the base URL.
	 * @param init Request options, excluding the method.
	 */
	get(path: string, init?: APIClientInit): Promise<Response> {
		return this.fetch(path, { ...init, method: "GET" });
	}

	/**
	 * Sends a `POST` request.
	 * @param path Path to request, resolved against the base URL.
	 * @param init Request options, excluding the method.
	 */
	post(path: string, init?: APIClientInit): Promise<Response> {
		return this.fetch(path, { ...init, method: "POST" });
	}

	/**
	 * Sends a `PUT` request.
	 * @param path Path to request, resolved against the base URL.
	 * @param init Request options, excluding the method.
	 */
	put(path: string, init?: APIClientInit): Promise<Response> {
		return this.fetch(path, { ...init, method: "PUT" });
	}

	/**
	 * Sends a `PATCH` request.
	 * @param path Path to request, resolved against the base URL.
	 * @param init Request options, excluding the method.
	 */
	patch(path: string, init?: APIClientInit): Promise<Response> {
		return this.fetch(path, { ...init, method: "PATCH" });
	}

	/**
	 * Sends a `DELETE` request.
	 * @param path Path to request, resolved against the base URL.
	 * @param init Request options, excluding the method.
	 */
	delete(path: string, init?: APIClientInit): Promise<Response> {
		return this.fetch(path, { ...init, method: "DELETE" });
	}
}
