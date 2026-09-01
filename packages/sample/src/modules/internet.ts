/**
 * Addresses, handles, and links. Every generated address lands on a domain
 * reserved for documentation, so a message built from this data has nowhere to
 * go even when a system tries to send it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Dataset } from "../dataset";
import type { Random } from "../random";

/**
 * The domains generated addresses and links use, reserved by RFC 2606 for
 * documentation and examples. They are fixed here rather than read from a
 * dataset, which keeps a custom dataset from introducing a routable domain.
 */
const RESERVED_DOMAINS = ["example.com", "example.org", "example.net"] as const;

const PASSWORD_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789-_";

const COMBINING_MARKS = /\p{M}+/gu;

const NON_HANDLE = /[^a-z0-9]+/g;

/** A name to derive a handle from, generated when a caller supplies none. */
export interface NameOptions {
	firstName?: string;
	lastName?: string;
}

/** Options for a generated password. */
export interface PasswordOptions {
	/** How many characters, 16 by default. */
	length?: number;
}

/** Addresses, handles, domains, links, and passwords. */
export interface InternetModule {
	/** An address on a reserved domain, matching the name it belongs to. */
	email(options?: NameOptions): string;
	/** A lowercase handle built from a first and last name. */
	username(options?: NameOptions): string;
	/** One of the reserved documentation domains. */
	domain(): string;
	/** An `https` link on a reserved domain. */
	url(): string;
	/** A password of printable characters. */
	password(options?: PasswordOptions): string;
}

/**
 * Fold a name into the ASCII letters and digits a handle is made of, so an
 * accented name yields a handle an address can carry.
 */
function handle(value: string): string {
	return value.normalize("NFKD").replace(COMBINING_MARKS, "").toLowerCase().replace(NON_HANDLE, "");
}

/** Create the `internet` module over one stream and dataset. */
export function createInternetModule(random: Random, data: Dataset): InternetModule {
	function names(options: NameOptions = {}) {
		return {
			firstName: options.firstName ?? random.pick(data.firstNames),
			lastName: options.lastName ?? random.pick(data.lastNames),
		};
	}

	let internet: InternetModule = {
		email(options) {
			let { firstName, lastName } = names(options);
			let suffix = random.int(1, 99);
			return `${handle(firstName)}.${handle(lastName)}${suffix}@${internet.domain()}`;
		},
		username(options) {
			let { firstName, lastName } = names(options);
			return `${handle(firstName)}.${handle(lastName)}`;
		},
		domain() {
			return random.pick(RESERVED_DOMAINS);
		},
		url() {
			return `https://${handle(random.pick(data.companyWords))}.${internet.domain()}`;
		},
		password(options = {}) {
			let length = options.length ?? 16;
			let characters = Array.from({ length }, () =>
				PASSWORD_ALPHABET.charAt(random.int(0, PASSWORD_ALPHABET.length - 1)),
			);
			return characters.join("");
		},
	};

	return internet;
}
