/**
 * A URL-like value object for a pathname, search params, and hash with no
 * origin, so relative paths can be built and mutated without a base URL.
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export namespace Location {
	export interface Options {
		pathname: string;
		search?: string | URLSearchParams;
		hash?: string;
	}

	export interface OriginOptions {
		origin?: string | URL;
	}

	export interface SafeOptions extends OriginOptions {
		fallback: string | URL | Location;
	}
}

export class Location implements Omit<
	URL,
	"origin" | "protocol" | "username" | "password" | "host" | "hostname" | "port" | "href"
> {
	// An unregistrable TLD, so a real caller origin can never match the sentinel.
	static #safeBase = "https://location.invalid";

	#pathname: string;
	#search: URLSearchParams;
	#hash: string;

	constructor(input: URL | Location | Location.Options) {
		this.#pathname = input.pathname;
		this.#search = new URLSearchParams(input.search);
		this.#hash = Location.#normalizeHash(input.hash);
	}

	get pathname() {
		return this.#pathname;
	}

	get search(): string {
		let search = this.#search.toString();
		return search ? `?${search}` : "";
	}

	get searchParams(): URLSearchParams {
		return this.#search;
	}

	get hash() {
		return this.#hash;
	}

	set pathname(value: string) {
		this.#pathname = value;
	}

	set search(value: string) {
		this.#search = new URLSearchParams(value.startsWith("?") ? value.slice(1) : value);
	}

	set hash(value: string) {
		this.#hash = Location.#normalizeHash(value);
	}

	toString() {
		let search = this.#search.toString();
		let parts = [this.#pathname];
		if (search) parts.push(`?${search}`);
		if (this.#hash) parts.push(`#${this.#hash}`);
		return parts.join("");
	}

	toJSON() {
		return this.toString();
	}

	static from(input: string | URL | Location): Location {
		if (typeof input === "string") {
			return Location.from(new URL(input, "https://example.com"));
		}

		if (input instanceof Location) return new Location(input);
		if (input instanceof URL) return new Location(input);

		throw new TypeError("Location.from expects a string, URL, or Location");
	}

	static safe(
		input: string | URL | Location | null | undefined,
		options: Location.SafeOptions,
	): Location {
		return Location.#resolveSafe(input, options) ?? Location.#resolveFallback(options.fallback);
	}

	static isSafe(input: unknown, options: Location.OriginOptions = {}): boolean {
		return Location.#resolveSafe(input, options) !== null;
	}

	static #resolveSafe(input: unknown, options: Location.OriginOptions): Location | null {
		if (input instanceof Location) return Location.#resolveSafe(input.toString(), options);
		if (input instanceof URL) return Location.#resolveSafe(input.href, options);
		if (typeof input !== "string" || !input) return null;

		// `new URL` trims leading spaces and C0 controls and strips tabs and newlines from
		// anywhere in the value, so a target carrying one hides its real destination from
		// every string-level check, and a newline would split the `Location` header.
		for (let char of input) {
			let code = char.charCodeAt(0);
			if (code <= 0x20 || code === 0x7f) return null;
		}

		if (!URL.canParse(input, Location.#safeBase)) return null;
		let url = new URL(input, Location.#safeBase);

		if (url.origin === Location.#safeBase) {
			// A relative target such as `ok` resolves against the current path rather than the
			// root, so accepting it would silently redirect somewhere the caller never named.
			if (!input.startsWith("/")) return null;
		} else if (!Location.#matchesOrigin(url, options.origin)) return null;

		return Location.#fromSafePath(url);
	}

	static #resolveFallback(fallback: string | URL | Location): Location {
		// `Location.from` discards the origin, so the remaining risk is a `//host` pathname.
		let location = Location.from(fallback);
		return Location.#isRootRelative(location.pathname) ? location : new Location({ pathname: "/" });
	}

	static #matchesOrigin(url: URL, origin: string | URL | undefined): boolean {
		if (origin === undefined) return false;
		if (!URL.canParse(origin)) return false;
		return url.origin === new URL(origin).origin;
	}

	static #fromSafePath(url: URL): Location | null {
		if (!Location.#isRootRelative(url.pathname)) return null;
		return new Location({ pathname: url.pathname, search: url.search, hash: url.hash.slice(1) });
	}

	// A second leading slash makes a path protocol-relative, which path normalization can
	// produce while resolution still reports our own origin.
	static #isRootRelative(pathname: string): boolean {
		return pathname.startsWith("/") && !/^\/[/\\]/.test(pathname);
	}

	// `URL#hash` carries the leading `#`, which `toString` adds back on its own.
	static #normalizeHash(value: string | undefined): string {
		if (!value) return "";
		return value.startsWith("#") ? value.slice(1) : value;
	}

	static canParse(input: unknown): boolean {
		if (input instanceof URL) return true;
		if (input instanceof Location) return true;
		if (typeof input === "string") {
			if (URL.canParse(input)) return true;
			if (URL.canParse(input, "https://example.com")) return true;
		}
		return false;
	}
}
