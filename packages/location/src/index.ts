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
}

export class Location implements Omit<
	URL,
	"origin" | "protocol" | "username" | "password" | "host" | "hostname" | "port" | "href"
> {
	#pathname: string;
	#search: URLSearchParams;
	#hash: string;

	constructor(input: URL | Location | Location.Options) {
		this.#pathname = input.pathname;
		this.#search = new URLSearchParams(input.search);
		this.#hash = input.hash || "";
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
		this.#hash = value;
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
