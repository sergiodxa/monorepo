/**
 * A stateful stand-in for Kit's API v4 as MSW handlers: subscribers, tags,
 * custom fields and forms behave as Kit documents them, so the conformance
 * suite drives the provider through real HTTP against consistent state.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { HttpHandler, PathParams } from "msw";

import { Hex, hmac } from "@sdxc/crypto";
import { unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";

/** The API origin every handler answers on. */
export const KIT_API = "https://api.kit.com/v4";

/** Page size Kit uses when a request names none. */
const KIT_DEFAULT_PAGE_SIZE = 500;

/** A subscriber as the fake holds it. */
interface FakeSubscriber {
	id: number;
	email_address: string;
	state: string;
	created_at: string;
	fields: Record<string, string | null>;
	tags: Map<number, string>;
	referrer: string | null;
}

/** A tag as the fake holds it. */
interface FakeTag {
	id: number;
	name: string;
	created_at: string;
}

/** How the fake account starts. */
export interface FakeKitOptions {
	/** The only key the fake accepts. */
	apiKey: string;
	/** Custom-field keys the account already has. */
	customFields?: readonly string[];
	/** Form ids the account has. */
	forms?: readonly string[];
}

/** Path parameters as single strings, which is every route here declares. */
type Params = Readonly<Record<string, string>>;

/** Reads a route's path parameters, keeping the first of any repeated one. */
function paramsOf(params: PathParams): Params {
	return Object.fromEntries(
		Object.entries(params).map(([key, value]) => [
			key,
			String(Array.isArray(value) ? value[0] : value),
		]),
	);
}

/** Kit's body for every failure. */
function errors(status: number, ...messages: string[]) {
	return HttpResponse.json({ errors: messages }, { status });
}

/** An opaque cursor naming the last id a page answered, the way Kit's are base64. */
function cursorOf(id: number): string {
	return btoa(JSON.stringify([id]));
}

/** Reads a cursor this fake issued back into the id it names. */
function idAfter(cursor: string | null): number {
	if (cursor === null) return 0;

	let parsed = JSON.parse(atob(cursor)) as [number];
	return parsed[0];
}

/**
 * Pages rows ordered by id from a request's `after` and `per_page`, answering
 * Kit's pagination block beside them.
 */
function paginate<Row extends { id: number }>(url: URL, rows: readonly Row[]) {
	let perPage = Number(url.searchParams.get("per_page") ?? KIT_DEFAULT_PAGE_SIZE);
	let after = idAfter(url.searchParams.get("after"));
	let remaining = rows.filter((row) => row.id > after);
	let page = remaining.slice(0, perPage);
	let first = page.at(0);
	let last = page.at(-1);

	return {
		items: page,
		pagination: {
			has_previous_page: after > 0,
			has_next_page: remaining.length > page.length,
			start_cursor: first ? cursorOf(first.id - 1) : null,
			end_cursor: last ? cursorOf(last.id) : null,
			per_page: perPage,
		},
	};
}

/** Whether a row passes a list's `status` filter, which defaults to `active`. */
function matchesStatus(url: URL, subscriber: FakeSubscriber): boolean {
	let status = url.searchParams.get("status") ?? "active";
	return status === "all" || subscriber.state === status;
}

/**
 * Signs a delivery body the way Kit does: HMAC-SHA256 of `t.body`, hex-encoded.
 *
 * @param secret - The endpoint's signing secret.
 * @param body - Exact body text.
 * @param timestamp - Signing time in Unix seconds.
 * @returns The `v1` value of `X-Kit-Signature`.
 */
export async function kitSignature(
	secret: string,
	body: string,
	timestamp: number,
): Promise<string> {
	return Hex.encode(unwrap(await hmac.sign(secret, `${timestamp}.${body}`)));
}

/**
 * An in-memory Kit account served through MSW. Every handler checks the key
 * first, as Kit does, so a test also sees how the provider reads a `401`.
 */
export class FakeKit {
	/** The handlers to install with `server.use`. */
	readonly handlers: HttpHandler[];

	#options: FakeKitOptions;

	#subscribers = new Map<number, FakeSubscriber>();

	#tags = new Map<number, FakeTag>();

	#sequence = 0;

	/**
	 * Creates an empty account.
	 *
	 * @param options - The accepted key, existing custom fields and forms.
	 */
	constructor(options: FakeKitOptions) {
		this.#options = options;
		this.handlers = this.#buildHandlers();
	}

	/**
	 * The referrer a form add recorded for an address.
	 *
	 * @param email - The subscriber's address.
	 * @returns The referrer, or `null` when none was recorded.
	 */
	referrerOf(email: string): string | null {
		return this.#find(email)?.referrer ?? null;
	}

	/**
	 * Sets a subscriber's state, the way a confirmation click or a bounce would.
	 *
	 * @param email - The subscriber's address.
	 * @param state - Kit's state to move it to.
	 */
	setState(email: string, state: string): void {
		let subscriber = this.#find(email);
		if (subscriber !== undefined) subscriber.state = state;
	}

	#find(email: string): FakeSubscriber | undefined {
		let wanted = email.toLowerCase();
		return [...this.#subscribers.values()].find(
			(subscriber) => subscriber.email_address.toLowerCase() === wanted,
		);
	}

	#nextId(): number {
		this.#sequence += 1;
		return this.#sequence;
	}

	#wire(subscriber: FakeSubscriber) {
		return {
			id: subscriber.id,
			first_name: null,
			email_address: subscriber.email_address,
			state: subscriber.state,
			created_at: subscriber.created_at,
			fields: { ...subscriber.fields },
		};
	}

	/** Writes field values, answering the keys the account has no field for. */
	#writeFields(subscriber: FakeSubscriber, fields: Record<string, string | null>): string[] {
		let known = this.#options.customFields ?? [];
		let warnings: string[] = [];

		for (let [key, value] of Object.entries(fields)) {
			if (known.includes(key)) subscriber.fields[key] = value === "" ? null : value;
			else warnings.push(key);
		}

		return warnings;
	}

	#authorized(request: Request): boolean {
		return request.headers.get("X-Kit-Api-Key") === this.#options.apiKey;
	}

	#buildHandlers(): HttpHandler[] {
		let guard =
			(handler: (input: { request: Request; params: Params }) => Promise<Response> | Response) =>
			({ request, params }: { request: Request; params: PathParams }) =>
				this.#authorized(request)
					? handler({ request, params: paramsOf(params) })
					: errors(401, "The access token is invalid");

		return [
			http.get(
				`${KIT_API}/subscribers`,
				guard(({ request }) => {
					let url = new URL(request.url);
					let email = url.searchParams.get("email_address")?.toLowerCase();
					let rows = [...this.#subscribers.values()].filter(
						(subscriber) =>
							matchesStatus(url, subscriber) &&
							(email === undefined || subscriber.email_address.toLowerCase() === email),
					);
					let page = paginate(url, rows);

					return HttpResponse.json({
						subscribers: page.items.map((row) => this.#wire(row)),
						pagination: page.pagination,
					});
				}),
			),

			http.post(
				`${KIT_API}/subscribers`,
				guard(async ({ request }) => {
					let body = (await request.json()) as {
						email_address?: string;
						state?: string;
						fields?: Record<string, string | null>;
					};

					if (body.email_address === undefined || !body.email_address.includes("@")) {
						return errors(422, "Email address is invalid");
					}

					let existing = this.#find(body.email_address);
					let subscriber: FakeSubscriber = existing ?? {
						id: this.#nextId(),
						email_address: body.email_address,
						state: body.state ?? "active",
						created_at: new Date().toISOString(),
						fields: Object.fromEntries(
							(this.#options.customFields ?? []).map((key) => [key, null]),
						),
						tags: new Map(),
						referrer: null,
					};

					this.#subscribers.set(subscriber.id, subscriber);
					let warnings = this.#writeFields(subscriber, body.fields ?? {});

					return HttpResponse.json(
						{
							subscriber: this.#wire(subscriber),
							...(warnings.length > 0 ? { warnings } : {}),
						},
						{ status: existing === undefined ? 201 : 200 },
					);
				}),
			),

			http.get(
				`${KIT_API}/subscribers/:id`,
				guard(({ params }) => {
					let subscriber = this.#subscribers.get(Number(params["id"]));
					if (subscriber === undefined) return errors(404, "Not Found");

					return HttpResponse.json({ subscriber: this.#wire(subscriber) });
				}),
			),

			http.put(
				`${KIT_API}/subscribers/:id`,
				guard(async ({ request, params }) => {
					let subscriber = this.#subscribers.get(Number(params["id"]));
					if (subscriber === undefined) return errors(404, "Not Found");

					let body = (await request.json()) as {
						email_address?: string;
						fields?: Record<string, string | null>;
					};
					if (body.email_address === undefined) return errors(422, "Email address is required");

					subscriber.email_address = body.email_address;
					let warnings = this.#writeFields(subscriber, body.fields ?? {});

					return HttpResponse.json({
						subscriber: this.#wire(subscriber),
						...(warnings.length > 0 ? { warnings } : {}),
					});
				}),
			),

			http.post(
				`${KIT_API}/subscribers/:id/unsubscribe`,
				guard(({ params }) => {
					let subscriber = this.#subscribers.get(Number(params["id"]));
					if (subscriber === undefined) return errors(404, "Not Found");

					subscriber.state = "cancelled";
					return new HttpResponse(null, { status: 204 });
				}),
			),

			http.get(
				`${KIT_API}/subscribers/:id/tags`,
				guard(({ request, params }) => {
					let subscriber = this.#subscribers.get(Number(params["id"]));
					if (subscriber === undefined) return errors(404, "Not Found");

					let rows = [...subscriber.tags.entries()].map(([id, tagged_at]) => ({
						id,
						name: this.#tags.get(id)?.name ?? "",
						tagged_at,
					}));
					let page = paginate(new URL(request.url), rows);

					return HttpResponse.json({ tags: page.items, pagination: page.pagination });
				}),
			),

			http.get(
				`${KIT_API}/tags`,
				guard(({ request }) => {
					let page = paginate(new URL(request.url), [...this.#tags.values()]);
					return HttpResponse.json({ tags: page.items, pagination: page.pagination });
				}),
			),

			http.post(
				`${KIT_API}/tags`,
				guard(async ({ request }) => {
					let body = (await request.json()) as { name?: string };
					let name = body.name?.trim() ?? "";
					if (name === "") return errors(422, "Name can't be blank");

					let existing = [...this.#tags.values()].find(
						(tag) => tag.name.toLowerCase() === name.toLowerCase(),
					);
					if (existing !== undefined) return HttpResponse.json({ tag: existing });

					let tag = { id: this.#nextId(), name, created_at: new Date().toISOString() };
					this.#tags.set(tag.id, tag);

					return HttpResponse.json({ tag }, { status: 201 });
				}),
			),

			http.get(
				`${KIT_API}/tags/:tagId/subscribers`,
				guard(({ request, params }) => {
					let tagId = Number(params["tagId"]);
					if (!this.#tags.has(tagId)) return errors(404, "Not Found");

					let url = new URL(request.url);
					let rows = [...this.#subscribers.values()].filter(
						(subscriber) => subscriber.tags.has(tagId) && matchesStatus(url, subscriber),
					);
					let page = paginate(url, rows);

					return HttpResponse.json({
						subscribers: page.items.map((row) => ({
							...this.#wire(row),
							tagged_at: row.tags.get(tagId),
						})),
						pagination: page.pagination,
					});
				}),
			),

			http.post(
				`${KIT_API}/tags/:tagId/subscribers/:id`,
				guard(({ params }) => {
					let tagId = Number(params["tagId"]);
					let subscriber = this.#subscribers.get(Number(params["id"]));
					if (subscriber === undefined || !this.#tags.has(tagId)) return errors(404, "Not Found");

					let already = subscriber.tags.has(tagId);
					if (!already) subscriber.tags.set(tagId, new Date().toISOString());

					return HttpResponse.json(
						{
							subscriber: { ...this.#wire(subscriber), tagged_at: subscriber.tags.get(tagId) },
						},
						{ status: already ? 200 : 201 },
					);
				}),
			),

			http.delete(
				`${KIT_API}/tags/:tagId/subscribers/:id`,
				guard(({ params }) => {
					let tagId = Number(params["tagId"]);
					let subscriber = this.#subscribers.get(Number(params["id"]));
					if (subscriber === undefined || !this.#tags.has(tagId)) return errors(404, "Not Found");

					subscriber.tags.delete(tagId);
					return new HttpResponse(null, { status: 204 });
				}),
			),

			http.get(
				`${KIT_API}/custom_fields`,
				guard(({ request }) => {
					let rows = (this.#options.customFields ?? []).map((key, index) => ({
						id: index + 1,
						name: `ck_field_${index + 1}_${key}`,
						key,
						label: key,
					}));
					let page = paginate(new URL(request.url), rows);

					return HttpResponse.json({ custom_fields: page.items, pagination: page.pagination });
				}),
			),

			http.post(
				`${KIT_API}/forms/:formId/subscribers`,
				guard(async ({ request, params }) => {
					if (!(this.#options.forms ?? []).includes(params["formId"] ?? ""))
						return errors(404, "Not Found");

					let body = (await request.json()) as { email_address?: string; referrer?: string };
					if (body.email_address === undefined) {
						return errors(
							422,
							"Either subscriber id or email address is required to add subscriber to form",
						);
					}

					let subscriber = this.#find(body.email_address);
					if (subscriber === undefined) return errors(404, "Not Found");

					subscriber.referrer = body.referrer ?? null;

					return HttpResponse.json(
						{
							subscriber: {
								...this.#wire(subscriber),
								added_at: new Date().toISOString(),
								referrer: subscriber.referrer,
							},
						},
						{ status: 201 },
					);
				}),
			),
		];
	}
}
