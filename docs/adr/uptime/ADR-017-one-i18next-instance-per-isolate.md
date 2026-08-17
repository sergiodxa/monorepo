# ADR-017: Build One i18next Instance per Isolate, Not per Request

## Status

**Accepted** — implemented 2026-07-30 (decisions 2 and 3; decision 1 rejected). Follows from
[ADR-002](./ADR-002-infrastructure-cost-per-monitor-type.md)
§7 and §17 (low). Affects `@pkg/i18n`, so it is not scoped to this app alone — see Scope.

## Context

`@pkg/i18n`'s middleware creates and initialises a fresh i18next instance on **every request**:

```ts
return async (context, next) => {
	let session = context.has(Session) ? context.get(Session) : undefined;
	let locale = await detector.detect(context.request, session);

	let instance = createInstance();
	for (let plugin of options.plugins ?? []) instance.use(plugin);

	await instance.init({
		supportedLngs: options.detection.supportedLanguages,
		fallbackLng: options.detection.fallbackLanguage,
		...options.i18next,
		lng: locale,
	});

	context.locale = locale;
	context.i18next = instance;

	return next();
};
```

The app passes all six locale bundles into `options.i18next.resources`:

```ts
resources: {
  en: { translation: en }, es: { translation: es }, de: { translation: de },
  ja: { translation: ja }, fr: { translation: fr }, it: { translation: it },
},
```

Those bundles total **614 KB of source** across `app/locales/*.ts`:

```text
112,819  en.ts      101,072  fr.ts
 99,609  de.ts       96,076  it.ts
 99,060  es.ts      105,544  ja.ts
```

So every request pays `createInstance()` plus `init()` over a six-language resource store, to
serve content in exactly one of them. The middleware's own docblock explains the design intent —
"no shared mutable language state between concurrent requests" — which is a real concern and the
reason it is written this way.

The cost is the largest single per-request CPU item in the app. It is also paid by requests that
render no translated content at all: the unauthenticated cron heartbeat endpoint, which returns
`{ wasOnTime }`, initialises 614 KB of translations first. ADR-002 models the heartbeat CPU band
at 3 / 8 / 20 ms largely because of this, against 1 / 3 / 8 ms for the check jobs.

In money it is small — at the expected 8 ms and $0.02 per million CPU-ms, ~$0.00000016 per
request, ~2% of a heartbeat's cost and ~$0.009/month for the reference account. It is listed as
low severity for that reason. But it scales with _every inbound request_, including ones that
never render a page, and CPU is the metric with the least headroom relative to its included quota
as request volume grows.

## Scope

This is a `@pkg/i18n` change, and `@pkg/i18n` is consumed by more than this app. The middleware's
contract — `context.locale` and `context.i18next` per request, no shared mutable state — must
hold for every consumer. So the decision below has to be safe generically, not just here. If that
turns out not to be achievable, decision 2 alone is app-local and still worth doing.

## Decision

**1. Build the instance once per isolate; derive per-request language from it.**

i18next supports creating a fixed-language accessor from an initialised instance without
mutating it — `instance.getFixedT(lng)` returns a `t` bound to a language, and `cloneInstance`
produces a per-request view sharing the parent's resource store. Either avoids re-parsing the
resource store per request while keeping per-request language isolation:

```ts
// module scope: initialised once per isolate, on first use
let shared: Promise<i18n> | undefined;
function sharedInstance(options) {
	shared ??= (async () => {
		let instance = createInstance();
		for (let plugin of options.plugins ?? []) instance.use(plugin);
		await instance.init({/* every supported language, no `lng` */});
		return instance;
	})();
	return shared;
}

// per request: no re-init, no shared mutable language
let parent = await sharedInstance(options);
context.locale = locale;
context.i18next = parent.cloneInstance({ lng: locale, initAsync: false });
```

The property that must be verified before shipping: `cloneInstance` must not mutate the parent's
language, and two concurrent clones on different languages must not interfere. That is a test,
not an assumption — and it is the whole reason the current code takes the expensive path, so it
deserves an explicit test rather than a claim in a docblock.

**Note on Workers module scope.** Initialising at module scope directly would run during Worker
startup, and this monorepo has been bitten by top-level work in a Worker before. The lazy
`shared ??=` above defers it to the first request in an isolate, which is the safe shape: the cost
is paid once per isolate, not at deploy time.

**2. Attach only the locales a request can use.**

Independent of decision 1, and simpler. The detector resolves one language before the instance is
built, so the resource store does not need the other five. Passing one bundle instead of six cuts
the initialisation work ~6× on its own. The fallback language must be included too, so it is two
bundles, not one.

This requires the resources to be addressable per language — trivially true, since they are six
separate module imports. The trade is bundle-level: all six are still imported and therefore still
in the Worker bundle, so this reduces _CPU_, not bundle size. Reducing bundle size would need
dynamic `import()` per locale, which is a larger change with its own cold-start trade-offs and is
out of scope here.

**3. Skip the middleware where nothing is translated.**

`i18n` is registered in the global middleware chain in `bootstrap/app.tsx`, so it runs for the
REST API and the cron heartbeat endpoint as well as HTML pages. Those routes return JSON and never
call `ctx.i18next.t`. Moving `i18n` off the global chain and onto the route groups that render HTML
removes the cost entirely for the API surface — including the highest-volume unauthenticated route
in the app.

This is the cheapest of the three and the one with the clearest boundary: `routes.api.*` and
`routes.api.cronJobPing` do not need it. Note the ordering constraint — the detector reads the
session when available, so `i18n` must still come after `createSessionMiddleware` wherever it is
registered.

**Implementation outcome.** Decisions 2 and 3 shipped; **decision 1 was deliberately not taken**.
Keeping `createInstance()` per request preserves the language isolation the current design already
guarantees with no shared mutable state to leak a language across requests, and attaching only the
two bundles a request can resolve through captures the bulk of the CPU saving without that risk —
which is the order of preference the Consequences below already argue for.

## Consequences

- **Per-request CPU falls**, by ~6× on the resource-store work from decision 2 alone, and to
  near-zero from decision 1. Decision 3 removes it outright for JSON routes.
- **The heartbeat endpoint stops paying for 614 KB of translations** to return two fields, which
  is the concrete case that motivated this. Composes with
  [ADR-016](./ADR-016-protect-the-public-endpoints.md): rate limiting bounds abuse of that route,
  this lowers what each legitimate call costs.
- **Money saved is small** — roughly $0.009/month at reference volume. This is a headroom and
  latency change, not a bill change, and should be prioritised accordingly.
- **Decision 1 carries real risk**: shared state across requests is exactly what the current
  design avoids. A cross-request language leak would be a subtle, high-embarrassment bug (a user
  served another user's language). Ship it only with a concurrency test, and prefer decisions 2
  and 3 first — they capture most of the benefit with none of the risk.
- **Decision 1 changes a shared package**, so it needs checking against every `@pkg/i18n`
  consumer, not just this app. Decisions 2 and 3 are configuration and wiring in this app only.
- **Decision 3 is a behaviour change if any API route does translate.** Grep for `i18next` under
  `app/http/controllers/api/` before moving it; if one does, either keep the middleware for that
  route or return untranslated strings deliberately.
