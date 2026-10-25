/**
 * The JMAP client: reads the Session once, sends batches to its API URL, uploads and
 * downloads blobs through its URL templates and opens its event-source stream, with the
 * caller's bearer token on every request and every failure returned as a `Result`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Problem } from "@sdxc/problem";
import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { APIClient } from "@sdxc/api-client";
import { parse as parseProblem } from "@sdxc/problem";
import { failure, isFailure, isSuccess, success } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";

import type { Batch } from "./batch.js";
import type { PushEvent } from "./push.js";
import type { JMAPResponseObject } from "./response.js";
import type { Session } from "./session.js";
import type { Id } from "./types.js";

import { JMAPRequestError } from "./error.js";
import { readPushEvents } from "./push.js";
import { BatchResponse, RESPONSE_SCHEMA } from "./response.js";
import { SESSION_SCHEMA } from "./session.js";
import { expand } from "./uri-template.js";

/** The structural check an upload's answer passes. */
const UPLOAD_SCHEMA = s.object({
	accountId: s.string(),
	blobId: s.string(),
	type: s.string(),
	size: s.number(),
});

/** Where an uploaded blob landed. */
export interface UploadedBlob {
	accountId: Id;
	/** The id later calls reference the bytes by; an unreferenced blob may be deleted after an hour. */
	blobId: Id;
	type: string;
	size: number;
}

/** The blob a download reads, and how the server should label it. */
export interface DownloadOptions {
	accountId: Id;
	blobId: Id;
	/** The file name the server sends in `Content-Disposition`. */
	name: string;
	/** The media type the server sends as `Content-Type`. */
	type: string;
}

/** What an event-source connection subscribes to. */
export interface EventsOptions {
	/** The type names to push, such as `["Email", "Mailbox"]`; every type by default. */
	types?: readonly string[];
	/** `"state"` ends the stream after one StateChange, for networks that buffer streams. */
	closeAfter?: "state" | "no";
	/**
	 * Seconds between `ping` events, which show the connection is alive; `0` turns them off.
	 * @default 300
	 */
	ping?: number;
	/** The last event id seen, so the server replays what a dropped connection missed. */
	lastEventId?: string;
	/** Ends the stream when aborted. */
	signal?: AbortSignal;
}

/**
 * A client of one JMAP account holder's server.
 *
 * @example
 * let jmap = new JMAP({ url: new URL("https://api.fastmail.com/jmap/session"), token });
 * let session = await jmap.session();
 */
export class JMAP extends APIClient {
	readonly #token: string;
	#session: Session | null = null;

	/** @param options - The session URL and the bearer token. */
	constructor(options: JMAP.Options) {
		let url = new URL(options.url);
		if (url.pathname === "/") url.pathname = "/.well-known/jmap";
		super(url);
		this.#token = options.token;
	}

	/**
	 * Sends every request with the caller's bearer token, the scheme RFC 8620 leaves to the
	 * deployment and Fastmail and Stalwart accept for API tokens.
	 *
	 * @param request - The outgoing request.
	 */
	protected override async before(request: Request): Promise<Request> {
		request.headers.set("Authorization", `Bearer ${this.#token}`);
		return request;
	}

	/**
	 * The Session, fetched on first use and kept until an API response reports a new
	 * `sessionState`, at which point the next call fetches it again.
	 *
	 * @returns The Session, or why it could not be read.
	 */
	async session(): Promise<Result<Session, JMAPRequestError>> {
		if (this.#session !== null) return success(this.#session);
		let response = await this.#send(this.baseURL.href, {
			method: "GET",
			headers: { Accept: "application/json" },
		});
		if (isFailure(response)) return response;
		let body = await readJson(response.data, SESSION_SCHEMA, "Session");
		if (isFailure(body)) return body;
		let session = body.data as unknown as Session;
		if (typeof session.capabilities["urn:ietf:params:jmap:core"] !== "object") {
			return failure(
				new JMAPRequestError("invalid-response", "The Session lacks the core capability."),
			);
		}
		this.#session = session;
		return success(session);
	}

	/**
	 * Sends `batch` as one API request. A method that failed is still a success here: read
	 * each call's outcome with `response.get(call)`.
	 *
	 * @param batch - The calls to make.
	 * @returns The method responses, or why the request as a whole was rejected.
	 */
	async send(batch: Batch): Promise<Result<BatchResponse, JMAPRequestError>> {
		let session = await this.session();
		if (isFailure(session)) return session;
		let response = await this.#send(session.data.apiUrl, {
			method: "POST",
			headers: { Accept: "application/json", "Content-Type": "application/json" },
			body: JSON.stringify(batch),
		});
		if (isFailure(response)) return response;
		let body = await readJson(response.data, RESPONSE_SCHEMA, "Response");
		if (isFailure(body)) return body;
		if (body.data.sessionState !== session.data.state) this.#session = null;
		return success(new BatchResponse(body.data as JMAPResponseObject));
	}

	/**
	 * Uploads bytes as a blob of `accountId`, for a later call to reference by `blobId`.
	 *
	 * @param accountId - The account the blob belongs to.
	 * @param body - The bytes.
	 * @param type - Their media type.
	 */
	async upload(
		accountId: Id,
		body: BodyInit,
		type: string,
	): Promise<Result<UploadedBlob, JMAPRequestError>> {
		let session = await this.session();
		if (isFailure(session)) return session;
		let response = await this.#send(expand(session.data.uploadUrl, { accountId }), {
			method: "POST",
			headers: { Accept: "application/json", "Content-Type": type },
			body,
		});
		if (isFailure(response)) return response;
		return await readJson(response.data, UPLOAD_SCHEMA, "upload response");
	}

	/**
	 * Downloads a blob. The response streams; read it with `.arrayBuffer()`, `.text()` or
	 * `.body`. Blob contents never change, so a caller may cache them by `blobId`.
	 *
	 * @param options - The blob and the name and type to label it with.
	 */
	async download(options: DownloadOptions): Promise<Result<Response, JMAPRequestError>> {
		let session = await this.session();
		if (isFailure(session)) return session;
		let url = expand(session.data.downloadUrl, {
			accountId: options.accountId,
			blobId: options.blobId,
			name: options.name,
			type: options.type,
		});
		return await this.#send(url, { method: "GET" });
	}

	/**
	 * Opens the event-source stream. Iterate the result for each StateChange and ping until the
	 * server closes the stream or `signal` aborts; reconnect with the last state's `id`.
	 *
	 * @param options - The types, close mode, ping interval and resume point.
	 */
	async events(
		options: EventsOptions = {},
	): Promise<Result<AsyncGenerator<PushEvent, void, undefined>, JMAPRequestError>> {
		let session = await this.session();
		if (isFailure(session)) return session;
		let url = expand(session.data.eventSourceUrl, {
			types: options.types === undefined ? "*" : options.types.join(","),
			closeafter: options.closeAfter ?? "no",
			ping: String(options.ping ?? 300),
		});
		let headers = new Headers({ Accept: "text/event-stream" });
		if (options.lastEventId !== undefined) headers.set("Last-Event-ID", options.lastEventId);
		let response = await this.#send(url, { method: "GET", headers, signal: options.signal });
		if (isFailure(response)) return response;
		if (response.data.body === null) {
			return failure(new JMAPRequestError("invalid-response", "The event source sent no body."));
		}
		return success(readPushEvents(response.data.body));
	}

	/**
	 * Sends one request and reads an HTTP error as a `JMAPRequestError`, with the problem
	 * details when the body is a JSON problem document.
	 *
	 * @param url - An absolute URL.
	 * @param init - The request.
	 */
	async #send(url: string, init: RequestInit): Promise<Result<Response, JMAPRequestError>> {
		let response: Response;
		try {
			response = await this.fetch(url, init);
		} catch (cause) {
			return failure(new JMAPRequestError("network", `The request to ${url} failed.`, { cause }));
		}
		if (response.ok) return success(response);
		let problem = await readProblem(response);
		let status = response.status;
		if (problem === null) {
			return failure(
				new JMAPRequestError("http", `The server answered ${status} to ${url}.`, { status }),
			);
		}
		return failure(
			new JMAPRequestError("problem", problem.detail ?? problem.title, { status, problem }),
		);
	}
}

/** Types the `JMAP` constructor reads. */
export namespace JMAP {
	/** How a client reaches its server. */
	export interface Options {
		/**
		 * The JMAP Session resource. A URL with only an origin, such as
		 * `https://jmap.example.com`, reads that host's `/.well-known/jmap`.
		 */
		url: URL | string;
		/** The bearer token sent with every request, such as a Fastmail API token. */
		token: string;
	}
}

/**
 * The response's problem details, read when it declares problem or plain JSON, since
 * servers answer JMAP errors with either.
 *
 * @param response - A non-2xx response.
 */
async function readProblem(response: Response): Promise<Problem | null> {
	let type = response.headers.get("Content-Type")?.split(";")[0]?.trim().toLowerCase();
	if (type !== "application/problem+json" && type !== "application/json") return null;
	let text = await response.text().catch(() => "");
	let problem = parseProblem(text, { status: response.status });
	return isSuccess(problem) ? problem.data : null;
}

/**
 * The response body as JSON checked by `schema`.
 *
 * @param response - A 2xx response.
 * @param schema - The structure the body must have.
 * @param what - The document's name, for the error message.
 */
async function readJson<Output>(
	response: Response,
	schema: StandardSchemaV1<unknown, Output>,
	what: string,
): Promise<Result<Output, JMAPRequestError>> {
	let json: unknown;
	try {
		json = await response.json();
	} catch (cause) {
		return failure(new JMAPRequestError("invalid-response", `The ${what} is not JSON.`, { cause }));
	}
	let checked = await validate(json as Record<string, unknown>, schema);
	if (isFailure(checked)) {
		return failure(
			new JMAPRequestError("invalid-response", `The ${what} is malformed.`, {
				cause: checked.error,
			}),
		);
	}
	return success(checked.data);
}
