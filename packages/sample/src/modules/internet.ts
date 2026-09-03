/**
 * Addresses, handles, links, and the protocol furniture around them. Every
 * generated address lands on a domain reserved for documentation, so a message
 * built from this data has nowhere to go even when a system tries to send it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { Base64Url } from "@sdxc/crypto";
import * as Algorithm from "@sdxc/jwt/algorithm";

import type { Dataset } from "../dataset";
import type { Random } from "../random";

/**
 * The domains generated addresses and links use, reserved by RFC 2606 for
 * documentation and examples. They are fixed here rather than read from a
 * dataset, which keeps a custom dataset from introducing a routable domain.
 */
const RESERVED_DOMAINS = ["example.com", "example.org", "example.net"] as const;

/** The suffixes of the reserved domains, for a caller that wants one alone. */
const RESERVED_SUFFIXES = ["com", "org", "net"] as const;

const PASSWORD_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789-_";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

const HTTP_STATUS_CODES = [
	200, 201, 202, 204, 301, 302, 304, 307, 308, 400, 401, 403, 404, 405, 409, 410, 418, 422, 429,
	500, 502, 503, 504,
] as const;

const PROTOCOLS = ["http", "https"] as const;

const BROWSERS = [
	{ name: "Chrome", version: () => "140.0.0.0" },
	{ name: "Firefox", version: () => "132.0" },
	{ name: "Safari", version: () => "18.2" },
	{ name: "Edge", version: () => "140.0.0.0" },
] as const;

const PLATFORMS = [
	"Macintosh; Intel Mac OS X 14_6",
	"Windows NT 10.0; Win64; x64",
	"X11; Linux x86_64",
	"iPhone; CPU iPhone OS 18_2 like Mac OS X",
	"Linux; Android 15",
] as const;

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

/** Options for a generated JWT. */
export interface JwtOptions {
	/** Claims merged over the generated ones. */
	payload?: Record<string, unknown>;
	/** The `alg` written into the header. */
	algorithm?: string;
}

/** Addresses, handles, domains, links, and protocol values. */
export interface InternetModule {
	/** An address on a reserved domain, matching the name it belongs to. */
	email(options?: NameOptions): string;
	/** A lowercase handle built from a first and last name. */
	username(options?: NameOptions): string;
	/** A human-facing name, as a profile shows it. */
	displayName(options?: NameOptions): string;
	/** One of the reserved documentation domains. */
	domainName(): string;
	/** The suffix of a reserved domain, such as `"com"`. */
	domainSuffix(): string;
	/** A single lowercase word a domain is built from. */
	domainWord(): string;
	/** An `https` link on a reserved domain. */
	url(options?: { appendSlash?: boolean; protocol?: string }): string;
	/** A password of legible characters. */
	password(options?: PasswordOptions): string;
	/** A single emoji. */
	emoji(): string;
	/** An HTTP verb. */
	httpMethod(): string;
	/** A status code an HTTP response can carry. */
	httpStatusCode(): number;
	/** An IPv4 or IPv6 address. */
	ip(): string;
	ipv4(): string;
	ipv6(): string;
	/** A MAC address, colon-separated. */
	mac(): string;
	/** A port number above the well-known range. */
	port(): number;
	/** A URL scheme, `http` or `https`. */
	protocol(): string;
	/** One of the signature algorithms tokens here are signed with. */
	jwtAlgorithm(): string;
	/**
	 * A token shaped like a JWT: three base64url segments, with generated claims
	 * a reader can decode. Its signature is drawn from the stream rather than
	 * computed over the payload, so the token fills a field or a header but
	 * never passes verification — a test that verifies wants a token signed with
	 * a key it controls.
	 */
	jwt(options?: JwtOptions): string;
	/** A browser user-agent string. */
	userAgent(): string;
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
			firstName:
				options.firstName ?? random.pick([...data.firstNames.female, ...data.firstNames.male]),
			lastName: options.lastName ?? random.pick(data.lastNames),
		};
	}

	let internet: InternetModule = {
		email(options) {
			let { firstName, lastName } = names(options);
			let suffix = random.int(1, 99);
			return `${handle(firstName)}.${handle(lastName)}${suffix}@${internet.domainName()}`;
		},
		username(options) {
			let { firstName, lastName } = names(options);
			return `${handle(firstName)}.${handle(lastName)}`;
		},
		displayName(options) {
			let { firstName, lastName } = names(options);
			return `${firstName} ${lastName.charAt(0)}.`;
		},
		domainName() {
			return random.pick(RESERVED_DOMAINS);
		},
		domainSuffix() {
			return random.pick(RESERVED_SUFFIXES);
		},
		domainWord() {
			return handle(random.pick(data.companyWords));
		},
		url(options = {}) {
			let protocol = options.protocol ?? "https";
			let slash = options.appendSlash === true ? "/" : "";
			return `${protocol}://${internet.domainWord()}.${internet.domainName()}${slash}`;
		},
		password(options = {}) {
			let length = options.length ?? 16;
			let characters = Array.from({ length }, () =>
				PASSWORD_ALPHABET.charAt(random.int(0, PASSWORD_ALPHABET.length - 1)),
			);
			return characters.join("");
		},
		emoji() {
			return random.pick(data.emojis);
		},
		httpMethod() {
			return random.pick(HTTP_METHODS);
		},
		httpStatusCode() {
			return random.pick(HTTP_STATUS_CODES);
		},
		ip() {
			return random.bool() ? internet.ipv4() : internet.ipv6();
		},
		ipv4() {
			return Array.from({ length: 4 }, () => random.int(0, 255)).join(".");
		},
		ipv6() {
			return Array.from({ length: 8 }, () =>
				random.int(0, 0xffff).toString(16).padStart(4, "0"),
			).join(":");
		},
		mac() {
			return Array.from({ length: 6 }, () => random.int(0, 255).toString(16).padStart(2, "0")).join(
				":",
			);
		},
		port() {
			return random.int(1024, 65535);
		},
		protocol() {
			return random.pick(PROTOCOLS);
		},
		jwtAlgorithm() {
			return random.pick(Object.values(Algorithm));
		},
		jwt(options = {}) {
			let issuedAt = Math.trunc(random.int(1_700_000_000, 1_800_000_000));
			let header = { alg: options.algorithm ?? internet.jwtAlgorithm(), typ: "JWT" };
			let payload = {
				sub: internet.username(),
				iss: internet.domainName(),
				aud: internet.domainWord(),
				iat: issuedAt,
				exp: issuedAt + 3600,
				...options.payload,
			};
			let signature = Array.from({ length: 32 }, () =>
				random.int(0, 255).toString(16).padStart(2, "0"),
			).join("");
			return [
				Base64Url.encode(JSON.stringify(header)),
				Base64Url.encode(JSON.stringify(payload)),
				signature,
			].join(".");
		},
		userAgent() {
			let browser = random.pick(BROWSERS);
			let platform = random.pick(PLATFORMS);
			return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) ${browser.name}/${browser.version()} Safari/537.36`;
		},
	};

	return internet;
}
