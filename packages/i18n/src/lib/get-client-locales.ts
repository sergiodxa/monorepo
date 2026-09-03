/**
 * Client locale resolution from the Accept-Language header. Returns the
 * client's best-quality locale that the JavaScript Intl APIs can represent, so
 * it can be passed directly to `Intl` formatters and `toLocale*` methods.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { formatLanguageString, parse, pick } from "./parser.js";

/**
 * Gets the client's preferred locale from the Accept-Language header,
 * ignoring wildcard ranges and unrepresentable tags. Returns `undefined` when
 * nothing remains, so callers can fall back to the runtime default locale.
 *
 * @param requestOrHeaders - The incoming Request, or its Headers.
 * @returns The best client locale, or `undefined` when unavailable.
 * @example let date = new Date().toLocaleDateString(getClientLocales(request));
 */
export function getClientLocales(headers: Headers): string | undefined;
export function getClientLocales(request: Request): string | undefined;
export function getClientLocales(requestOrHeaders: Request | Headers): string | undefined {
	let headers = requestOrHeaders instanceof Request ? requestOrHeaders.headers : requestOrHeaders;

	let acceptLanguage = headers.get("Accept-Language");
	if (!acceptLanguage) return undefined;

	let parsedLocales = parse(acceptLanguage)
		.filter((language) => language.code !== "*")
		.map(formatLanguageString);

	let validLocales: string[] = [];

	for (let locale of parsedLocales) {
		try {
			new Intl.Locale(locale);
			validLocales.push(locale);
		} catch {}
	}

	let locale = pick(Intl.DateTimeFormat.supportedLocalesOf(validLocales), acceptLanguage);

	return locale ?? undefined;
}
