/**
 * Request-scoped logger that buckets events by HTTP lifecycle phase and
 * filters headers before they reach log output.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { IncomingRequestCfProperties } from "@cloudflare/workers-types";

import { Logger as BatchedLogger } from "./batched-logger.js";

export namespace Logger {
	export interface Subject {
		id: string;
		[key: string]: unknown;
	}

	export interface Profile {
		[key: string]: unknown;
	}

	export interface Billing {
		polarId: string;
		[key: string]: unknown;
	}

	export interface CloudflareInfo {
		colo: string;
		country: string | null;
		city: string | null;
		region: string | null;
		timezone: string;
		asn: number;
		asOrganization: string;
		httpProtocol: string;
		tlsVersion: string;
	}

	export interface RequestInfo {
		url: {
			protocol: string;
			hostname: string;
			pathname: string;
			search: string;
		};
		method: string;
		headers: Record<string, string>;
		cf?: CloudflareInfo;
	}

	export interface ResponseInfo {
		status: number;
		headers: Record<string, string>;
	}

	export interface Event {
		level: "info" | "error";
		event: string;
		[key: string]: unknown;
	}

	export type ScopeType = keyof Scopes;

	export interface Scopes {
		middleware: Map<string, BatchedLogger>;
		loader: Map<string, BatchedLogger>;
		action: { routeId: string; logger: BatchedLogger } | null;
		render: BatchedLogger | null;
		unscoped: BatchedLogger;
	}

	export interface Output {
		id: string;
		timestamp: number;
		duration: number;
		request: RequestInfo;
		response?: ResponseInfo;
		subject?: Subject;
		profile?: Profile;
		billing?: Billing;
		middleware?: Record<string, Event[]>;
		loaders?: Record<string, Event[]>;
		action?: { routeId: string; events: Event[] };
		render?: Event[];
		events?: Event[];
	}
}

const ALLOWED_REQUEST_HEADERS = new Set([
	"content-type",
	"accept",
	"accept-language",
	"accept-encoding",
	"user-agent",
	"referer",
	"origin",
	"x-forwarded-for",
	"x-real-ip",
	"x-forwarded-proto",
	"x-forwarded-host",
	"x-request-id",
	"x-correlation-id",
]);

const EXCLUDED_REQUEST_HEADER_PATTERNS = [
	"authorization",
	"cookie",
	"x-api-key",
	"x-auth-token",
	"secret",
	"token",
	"key",
	"password",
	"credential",
];

const ALLOWED_RESPONSE_HEADERS = new Set([
	"content-type",
	"content-length",
	"content-encoding",
	"cache-control",
	"etag",
	"last-modified",
	"location",
	"x-request-id",
	"cf-ray",
	"server-timing",
]);

const EXCLUDED_RESPONSE_HEADERS = new Set(["set-cookie"]);

function isHeaderExcluded(headerName: string): boolean {
	let lower = headerName.toLowerCase();
	return EXCLUDED_REQUEST_HEADER_PATTERNS.some((pattern) => lower.includes(pattern));
}

function filterRequestHeaders(headers: Headers): Record<string, string> {
	let filtered: Record<string, string> = {};
	for (let [name, value] of headers) {
		let lower = name.toLowerCase();
		if (ALLOWED_REQUEST_HEADERS.has(lower) && !isHeaderExcluded(lower)) {
			filtered[lower] = value;
		}
	}
	return filtered;
}

/**
 * Excludes the `set-cookie` value since it carries session data, but keeps
 * the cookie names so session and auth issues stay debuggable.
 */
function filterResponseHeaders(headers: Headers): Record<string, string> {
	let filtered: Record<string, string> = {};
	for (let [name, value] of headers) {
		let lower = name.toLowerCase();
		if (ALLOWED_RESPONSE_HEADERS.has(lower) && !EXCLUDED_RESPONSE_HEADERS.has(lower)) {
			filtered[lower] = value;
		}
	}

	let cookieNames = headers.getSetCookie?.().map((raw) => raw.split("=")[0]);
	if (cookieNames && cookieNames.length > 0) filtered["set-cookie-names"] = cookieNames.join(", ");

	return filtered;
}

function extractCfInfo(
	cf: IncomingRequestCfProperties | undefined,
): Logger.CloudflareInfo | undefined {
	if (!cf) return;
	return {
		colo: cf.colo ?? "unknown",
		country: cf.country ?? null,
		city: cf.city ?? null,
		region: cf.region ?? null,
		timezone: cf.timezone ?? "unknown",
		asn: cf.asn ?? 0,
		asOrganization: cf.asOrganization ?? "unknown",
		httpProtocol: cf.httpProtocol ?? "unknown",
		tlsVersion: cf.tlsVersion ?? "unknown",
	};
}

/**
 * Request-scoped logger optimized for React Router HTTP requests.
 * Organizes logs by lifecycle phase (middleware, loaders, actions, render).
 */
export class Logger {
	#id: string;
	#url: URL;
	#startTime: number;
	#requestInfo: Logger.RequestInfo;
	#responseInfo: Logger.ResponseInfo | null = null;

	#subject: Logger.Subject | null = null;
	#profile: Logger.Profile | null = null;
	#billing: Logger.Billing | null = null;

	#scopes: Logger.Scopes = {
		middleware: new Map<string, BatchedLogger>(),
		loader: new Map<string, BatchedLogger>(),
		action: null as { routeId: string; logger: BatchedLogger } | null,
		render: null as BatchedLogger | null,
		unscoped: new BatchedLogger("unscoped"),
	};

	constructor(request: Request) {
		this.#startTime = performance.now();

		this.#id = request.headers.get("cf-ray") ?? crypto.randomUUID();

		this.#url = new URL(request.url);
		let cf = (request as Request & { cf?: IncomingRequestCfProperties }).cf;

		this.#requestInfo = {
			url: {
				protocol: this.#url.protocol,
				hostname: this.#url.hostname,
				pathname: this.#url.pathname,
				search: this.#url.search,
			},
			method: request.method,
			headers: filterRequestHeaders(request.headers),
			cf: extractCfInfo(cf),
		};
	}

	get identifier() {
		let status = this.#responseInfo?.status ?? "???";
		return [this.#requestInfo.method, this.#url.href, status].join(" ");
	}

	set subject(subject: Logger.Subject) {
		this.#subject = subject;
	}

	set profile(profile: Logger.Profile) {
		this.#profile = profile;
	}

	set billing(billing: Logger.Billing) {
		this.#billing = billing;
	}

	set response(response: Response) {
		this.#responseInfo = {
			status: response.status,
			headers: filterResponseHeaders(response.headers),
		};
	}

	/**
	 * Get or create a scoped logger for a middleware.
	 */
	middleware(name: string): BatchedLogger {
		let existing = this.#scopes.middleware.get(name);
		if (existing) return existing;

		let logger = new BatchedLogger(`middleware:${name}`);
		this.#scopes.middleware.set(name, logger);
		return logger;
	}

	/**
	 * Get or create a scoped logger for a loader.
	 */
	loader(routeId: string): BatchedLogger {
		let existing = this.#scopes.loader.get(routeId);
		if (existing) return existing;

		let logger = new BatchedLogger(`loader:${routeId}`);
		this.#scopes.loader.set(routeId, logger);
		return logger;
	}

	/**
	 * Get or create a scoped logger for an action.
	 * Only one action can run per request.
	 */
	action(routeId: string): BatchedLogger {
		if (this.#scopes.action) {
			if (this.#scopes.action.routeId === routeId) {
				return this.#scopes.action.logger;
			}
		}

		let logger = new BatchedLogger(`action:${routeId}`);
		this.#scopes.action = { routeId, logger };
		return logger;
	}

	/**
	 * Get the scoped logger for the render phase.
	 */
	get render(): BatchedLogger {
		if (!this.#scopes.render) {
			this.#scopes.render = new BatchedLogger("render");
		}
		return this.#scopes.render;
	}

	/**
	 * Log an info event without a specific scope.
	 * Use this for catch blocks or edge cases.
	 */
	info(event: string, payload?: Record<string, unknown>): void {
		this.#scopes.unscoped.info(event, payload);
	}

	/**
	 * Log an error event without a specific scope.
	 * Use this for catch blocks or edge cases.
	 */
	error(event: string, payload?: Record<string, unknown>): void {
		this.#scopes.unscoped.error(event, payload);
	}

	toJSON() {
		let duration = performance.now() - this.#startTime;

		let output: Logger.Output = {
			id: this.#id,
			timestamp: this.#startTime,
			duration,
			request: this.#requestInfo,
		};

		if (!this.#requestInfo.cf) delete output.request.cf;

		if (this.#responseInfo) output.response = this.#responseInfo;
		if (this.#subject) output.subject = this.#subject;
		if (this.#profile) output.profile = this.#profile;
		if (this.#billing) output.billing = this.#billing;

		if (this.#scopes.middleware.size > 0) {
			let middlewareOutput: Record<string, Logger.Event[]> = {};

			for (let [name, logger] of this.#scopes.middleware) {
				if (logger.hasEvents) middlewareOutput[name] = logger.events;
			}

			output.middleware = middlewareOutput;
		}

		if (this.#scopes.loader.size > 0) {
			let loaderOutput: Record<string, Logger.Event[]> = {};

			for (let [routeId, logger] of this.#scopes.loader) {
				if (logger.hasEvents) loaderOutput[routeId] = logger.events;
			}

			output.loaders = loaderOutput;
		}

		if (this.#scopes.action && this.#scopes.action.logger.hasEvents) {
			output.action = {
				routeId: this.#scopes.action.routeId,
				events: this.#scopes.action.logger.events,
			};
		}

		if (this.#scopes.render && this.#scopes.render.hasEvents)
			output.render = this.#scopes.render.events;

		if (this.#scopes.unscoped.hasEvents) output.events = this.#scopes.unscoped.events;

		return output;
	}

	/**
	 * Flush all accumulated logs to console as a single log entry.
	 */
	flush(): void {
		let output = this.toJSON();
		if (this.#hasError()) console.error(this.identifier, output);
		else console.info(this.identifier, output);
	}

	#hasError(): boolean {
		if (this.#scopes.unscoped.hasError) return true;
		if (this.#scopes.action && this.#scopes.action.logger.hasError) return true;
		if (this.#scopes.render && this.#scopes.render.hasError) return true;

		for (let [, logger] of this.#scopes.middleware) {
			if (logger.hasError) return true;
		}

		for (let [, logger] of this.#scopes.loader) {
			if (logger.hasError) return true;
		}

		return false;
	}
}
