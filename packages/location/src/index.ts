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

	constructor(options: Location.Options) {
		this.#pathname = options.pathname;
		this.#search = new URLSearchParams(options.search);
		this.#hash = options.hash || "";
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
		return this.#pathname + (search ? `?${search}` : "") + (this.#hash ? `#${this.#hash}` : "");
	}

	toJSON() {
		return this.toString();
	}

	static from(input: string | URL | Location): Location | undefined {
		if (typeof input === "string") {
			if (URL.canParse(input)) return Location.from(new URL(input));
			let url = new URL(input, "https://example.com");
			return Location.from(url);
		}

		if (input instanceof Location) {
			return new Location({
				pathname: input.pathname,
				search: input.search,
				hash: input.hash,
			});
		}

		if (input instanceof URL) {
			return new Location({
				pathname: input.pathname,
				search: input.searchParams,
				hash: input.hash,
			});
		}
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
