/**
 * Remix fetch-router middleware that detects the request language and publishes
 * a per-request i18next instance on the request context. Handlers translate
 * through `context.i18next` / `context.locale` without any shared mutable
 * language state between concurrent requests.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { i18n, InitOptions, Module, NewableModule, Resource } from "i18next";
import type { Middleware } from "remix/router";

import { createInstance } from "i18next";
import { Session } from "remix/session";

import type { LanguageDetectorOptions } from "./lib/language-detector";

import { LanguageDetector } from "./lib/language-detector";

// Declared here (an imported module, not an ambient .d.ts) so the augmentation
// is applied in consuming projects that import the middleware.
declare module "remix/router" {
	interface RequestContext {
		/** Language detected for the current request, always a supported language. */
		locale: string;
		/** Per-request i18next instance initialized with the detected language. */
		i18next: i18n;
	}
}

/** Options that configure the i18next middleware. */
export interface I18nextMiddlewareOptions {
	/** Language detection configuration; see {@link LanguageDetectorOptions}. */
	detection: LanguageDetectorOptions;
	/**
	 * i18next init options for the per-request instance. `supportedLngs` and
	 * `fallbackLng` default to the detection configuration so both layers stay
	 * in sync, `lng` is always overridden with the detected language, and
	 * `resources` is narrowed to the bundles that language can resolve through.
	 */
	i18next?: Omit<InitOptions, "detection">;
	/**
	 * i18next plugins (e.g. a backend that loads translations) registered on the
	 * per-request instance before it initializes.
	 */
	plugins?: NewableModule<Module>[] | Module[];
}

/**
 * Creates a middleware that detects the request language and initializes a
 * dedicated i18next instance for the request, exposing both as
 * `context.locale` and `context.i18next`.
 *
 * The language is resolved before the instance exists, so the instance is built
 * over only the bundles that language can resolve through — its own and the
 * fallback's — instead of every supported language. Nothing is shared between
 * requests: one instance per request is what keeps a concurrent request in
 * another language from ever seeing this one's.
 *
 * When the session middleware runs earlier in the chain, the detector reads the
 * language from the live request session instead of loading it from storage a
 * second time. Initialization awaits the instance's initial namespace load, so
 * backend-plugin translations are ready when handlers run.
 *
 * @param options - Middleware configuration; see {@link I18nextMiddlewareOptions}.
 * @returns A middleware that populates `context.locale` and `context.i18next`.
 * @example
 * let router = createRouter({ middleware: [i18next({ detection })] });
 */
export default function i18next(options: I18nextMiddlewareOptions): Middleware {
	let detector = new LanguageDetector(options.detection);

	return async (context, next) => {
		let session = context.has(Session) ? context.get(Session) : undefined;
		let locale = await detector.detect(context.request, session);

		let instance = createInstance();
		for (let plugin of options.plugins ?? []) instance.use(plugin);

		await instance.init({
			supportedLngs: options.detection.supportedLanguages,
			fallbackLng: options.detection.fallbackLanguage,
			...options.i18next,
			resources: pickResources(
				options.i18next?.resources,
				locale,
				options.detection.fallbackLanguage,
			),
			lng: locale,
		});

		context.locale = locale;
		context.i18next = instance;

		return next();
	};
}

/**
 * Narrows inline resources to the bundles `locale` can resolve through: itself,
 * the fallback language, and each one's primary subtag (an `en-US` request
 * resolves through an `en` bundle). Every other language is dropped, so a
 * request never pays to attach bundles it cannot serve.
 *
 * Returns `undefined` when no resources were configured, since i18next only
 * consults a backend plugin while `resources` is unset.
 *
 * @param resources - Inline resources from the middleware configuration, if any.
 * @param locale - The language detected for the request.
 * @param fallbackLanguage - The language i18next falls back to for missing keys.
 * @returns The narrowed resources, or `undefined` when there are none.
 */
function pickResources(
	resources: Resource | undefined,
	locale: string,
	fallbackLanguage: string,
): Resource | undefined {
	if (!resources) return undefined;

	let candidates = new Set([
		locale,
		locale.split("-")[0],
		fallbackLanguage,
		fallbackLanguage.split("-")[0],
	]);

	let picked: Resource = {};

	for (let candidate of candidates) {
		if (!candidate) continue;
		let bundle = resources[candidate];
		if (bundle) picked[candidate] = bundle;
	}

	return picked;
}
