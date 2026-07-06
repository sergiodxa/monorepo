/**
 * Server-side language detection. Resolves the user's preferred language from a
 * Request by probing search params, a cookie, the session, the Accept-Language
 * header, and custom logic, in a configurable order, always falling back to a
 * guaranteed language.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Cookie } from "remix/cookie";
import type { Session, SessionStorage } from "remix/session";

import { pick } from "./parser";

/** A source the detector can probe for the user's preferred language. */
export type DetectionMethod = "searchParams" | "cookie" | "session" | "header" | "custom";

/** Options that configure a {@link LanguageDetector}. */
export interface LanguageDetectorOptions {
	/**
	 * The languages the application supports. Detected values are matched
	 * against this list (strictly first, then loosely by primary code), so the
	 * detector never returns a language the application cannot serve. Keep it
	 * in sync with the `supportedLngs` i18next option.
	 */
	supportedLanguages: string[];
	/**
	 * The language used when no detection method produces a supported match.
	 * Keep it in sync with the `fallbackLng` i18next option.
	 */
	fallbackLanguage: string;
	/**
	 * Cookie that stores the user's preferred language as its plain value. When
	 * omitted, the `cookie` method is skipped.
	 */
	cookie?: Cookie;
	/**
	 * Cookie that holds the session identifier, paired with `sessionStorage` to
	 * read the session outside of middleware. Both must be set for the
	 * `session` method to read from storage.
	 */
	sessionCookie?: Cookie;
	/**
	 * Storage backend used to read the session identified by `sessionCookie`.
	 * Unnecessary when a live `Session` is passed to {@link LanguageDetector.detect}.
	 */
	sessionStorage?: SessionStorage;
	/**
	 * Session key that stores the user's preferred language.
	 * @default "lng"
	 */
	sessionKey?: string;
	/**
	 * Search parameter name checked for the language.
	 * @default "lng"
	 */
	searchParamKey?: string;
	/**
	 * The order in which detection methods run. The first supported match wins;
	 * methods missing their required option are skipped. Defaults to
	 * `searchParams`, `cookie`, `session`, `header`, with `custom` prepended
	 * when `findLocale` is provided.
	 */
	order?: DetectionMethod[];
	/**
	 * Custom lookup used by the `custom` method, e.g. reading the locale from
	 * the URL pathname or a database. Return `null` to defer to later methods.
	 * @param request - The incoming request.
	 */
	findLocale?(request: Request): Promise<string | string[] | null>;
}

/**
 * Detects the user's preferred language fully server-side from a Request,
 * using search params, a cookie, the session, the Accept-Language header, or
 * custom logic. Every candidate is validated against the supported languages,
 * and the fallback language is returned when nothing matches, so the result is
 * always a language the application can serve.
 */
export class LanguageDetector {
	/**
	 * @param options - Detection configuration; see {@link LanguageDetectorOptions}.
	 */
	constructor(private options: LanguageDetectorOptions) {}

	/**
	 * Detects the language for the given request by probing each configured
	 * method in order and returning the first supported match.
	 *
	 * @param request - The incoming request.
	 * @param session - A live session for the request; when provided, the
	 * `session` method reads it directly instead of loading from storage.
	 * @returns The detected language, or the fallback language when no method matches.
	 * @example let locale = await detector.detect(request);
	 */
	async detect(request: Request, session?: Session): Promise<string> {
		let order = this.options.order ?? this.defaultOrder;

		for (let method of order) {
			let locale: string | null = null;

			if (method === "searchParams") locale = this.fromSearchParams(request);
			if (method === "cookie") locale = await this.fromCookie(request);
			if (method === "session") {
				locale = session ? this.fromSession(session) : await this.fromSessionStorage(request);
			}
			if (method === "header") locale = this.fromHeader(request);
			if (method === "custom") locale = await this.fromCustom(request);

			if (locale) return locale;
		}

		return this.options.fallbackLanguage;
	}

	/** Default probing order, with `custom` first when a `findLocale` is configured. */
	private get defaultOrder(): DetectionMethod[] {
		let order: DetectionMethod[] = ["searchParams", "cookie", "session", "header"];
		if (this.options.findLocale) order.unshift("custom");
		return order;
	}

	/** Reads the language from the configured search parameter, if present. */
	private fromSearchParams(request: Request): string | null {
		let url = new URL(request.url);
		let value = url.searchParams.get(this.options.searchParamKey ?? "lng");
		if (!value) return null;
		return this.fromSupported(value);
	}

	/** Reads the language from the configured cookie, if any. */
	private async fromCookie(request: Request): Promise<string | null> {
		if (!this.options.cookie) return null;

		let value = await this.options.cookie.parse(request.headers.get("Cookie"));
		if (!value) return null;

		return this.fromSupported(value);
	}

	/** Reads the language from a live session provided by the caller. */
	private fromSession(session: Session): string | null {
		let value = session.get(this.options.sessionKey ?? "lng");
		if (typeof value !== "string" || !value) return null;
		return this.fromSupported(value);
	}

	/** Loads the session from storage using the session cookie and reads the language. */
	private async fromSessionStorage(request: Request): Promise<string | null> {
		if (!this.options.sessionCookie || !this.options.sessionStorage) return null;

		let cookieValue = await this.options.sessionCookie.parse(request.headers.get("Cookie"));
		let session = await this.options.sessionStorage.read(cookieValue);

		return this.fromSession(session);
	}

	/**
	 * Matches the raw Accept-Language header against the supported languages,
	 * honoring the client's quality ordering across every range it sent.
	 */
	private fromHeader(request: Request): string | null {
		return this.fromSupported(request.headers.get("Accept-Language"));
	}

	/** Resolves the language through the configured `findLocale` lookup, if any. */
	private async fromCustom(request: Request): Promise<string | null> {
		if (!this.options.findLocale) return null;

		let locales = await this.options.findLocale(request);
		if (!locales) return null;
		if (Array.isArray(locales)) return this.fromSupported(locales.join(","));
		return this.fromSupported(locales);
	}

	/**
	 * Validates a candidate against the supported languages: exact subtag match
	 * first, then a loose match on the primary language code.
	 */
	private fromSupported(language: string | null): string | null {
		if (!language) return null;
		return (
			pick(this.options.supportedLanguages, language, { loose: false }) ??
			pick(this.options.supportedLanguages, language, { loose: true })
		);
	}
}
