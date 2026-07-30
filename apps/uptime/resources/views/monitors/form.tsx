/**
 * Shared HTTP monitor form fields, used by both the new-monitor and edit-monitor
 * views. Renders name/URL/check-interval/expected-status/region inputs, pre-filled
 * from `handle.props.monitor` when editing. Method, timeout and degraded-threshold
 * aren't collected here — they keep their table default on create (HEAD / 10s /
 * 5000ms) and stay untouched on update, the same way the region select has no
 * pre-selected value on create but keeps the monitor's existing one on edit. SSL
 * settings are a separate form/action. It exists so the two pages don't duplicate
 * the field markup.
 *
 * Name/URL render through `@pkg/r3-ui`'s `TextField` convenience wrapper directly
 * (its own composed label/description covers them, so the local `Field` wrapper
 * isn't needed for either); status/region render through `@pkg/r3-ui`'s `Select`
 * still wrapped in `Field`, since `Select` has no composed label/description part
 * of its own the way `TextField` does. `i18next.getFixedT(...)` — a valid,
 * already-working i18n approach — is unchanged; only the underlying markup moved
 * to r3-ui.
 *
 * The `EXPECTED_STATUS_CODES` option labels ("200 OK", "201 Created", …) stay
 * hardcoded English on purpose: an HTTP status code and its standard reason
 * phrase is a fixed, protocol-defined pairing — closer to a technical, enum-like
 * label than to translatable prose — so it's left untranslated the same way a
 * unit symbol or a country code would be. The region hints, by contrast, ARE
 * ordinary prose describing a place, and this app's own locale files already
 * carry the matching `page.<page>.form.fields.region.options.*` keys (with a
 * `{{emoji}}` placeholder) — previously unused here — so `LOCATION_HINTS` now
 * renders through those keys instead of the hardcoded English labels it had
 * before.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { getContext } from "remix/async-context-middleware";
import type { Handle } from "remix/ui";

import { Select, TextField } from "@pkg/r3-ui";
import { mbe } from "@pkg/u/size";

import type { SelectMonitor } from "~/database/schema";

import Field from "~/resources/components/field";
import RangeSlider from "~/resources/components/range-slider";

/** Cloudflare Durable Object location hints this app offers as monitoring regions. */
const LOCATION_HINTS = ["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"] as const;

/**
 * Compact, representative animal emoji for each {@link LOCATION_HINTS} region hint,
 * spliced into its translated label — kept local to this module since no shared
 * copy of this mapping exists elsewhere in this app yet.
 */
const LOCATION_HINT_EMOJI: Record<(typeof LOCATION_HINTS)[number], string> = {
	wnam: "🦬",
	enam: "🦅",
	sam: "🦙",
	weur: "🦊",
	eeur: "🐻",
	apac: "🐉",
	oc: "🐨",
	afr: "🦁",
	me: "🐫",
};

/** Common HTTP status codes a healthy endpoint might return. Left untranslated — see this module's own doc comment for why. */
const EXPECTED_STATUS_CODES = [
	{ value: 200, label: "200 OK" },
	{ value: 201, label: "201 Created" },
	{ value: 202, label: "202 Accepted" },
	{ value: 204, label: "204 No Content" },
	{ value: 301, label: "301 Moved Permanently" },
	{ value: 302, label: "302 Found" },
	{ value: 303, label: "303 See Other" },
	{ value: 304, label: "304 Not Modified" },
	{ value: 307, label: "307 Temporary Redirect" },
	{ value: 308, label: "308 Permanent Redirect" },
	{ value: 400, label: "400 Bad Request" },
	{ value: 401, label: "401 Unauthorized" },
	{ value: 403, label: "403 Forbidden" },
	{ value: 404, label: "404 Not Found" },
	{ value: 405, label: "405 Method Not Allowed" },
	{ value: 429, label: "429 Too Many Requests" },
	{ value: 500, label: "500 Internal Server Error" },
	{ value: 502, label: "502 Bad Gateway" },
	{ value: 503, label: "503 Service Unavailable" },
] as const;

namespace MonitorFormFields {
	export interface Props {
		/** Existing monitor values when editing; omitted when creating. */
		monitor?: SelectMonitor;
		/** The request's i18next instance, used to read this page's `form.fields.*` copy. */
		i18next: ReturnType<typeof getContext>["i18next"];
		/** Which page is rendering these fields, selecting the `page.<page>.form.fields.*` keys to read. */
		page: "createMonitor" | "editMonitor";
	}
}

/** Renders the name/URL/check-interval/expected-status/region fields, pre-filled from `monitor` when editing and defaulted to a 10-minute interval expecting status 200 when creating. */
export default function MonitorFormFields(handle: Handle<MonitorFormFields.Props>) {
	return () => {
		let { monitor, i18next, page } = handle.props;
		let t = i18next.getFixedT(null, "translation", `page.${page}.form.fields`);

		let expectedStatus = monitor?.expected_status ?? 200;
		let locationHint = monitor?.location_hint;

		return (
			<>
				<TextField
					label={t("name.label")}
					description={t("name.description")}
					type="text"
					name="name"
					required
					defaultValue={monitor?.name}
					placeholder={t("name.placeholder")}
					mix={[mbe("28px")]}
				/>

				<TextField
					label={t("url.label")}
					description={t("url.description")}
					type="url"
					name="url"
					required
					defaultValue={monitor?.url}
					placeholder={t("url.placeholder")}
					mix={[mbe("28px")]}
				/>

				<RangeSlider
					label={t("interval.label")}
					name="interval_seconds"
					min={60}
					max={3600}
					step={60}
					scale={60}
					unit="m"
					defaultValue={monitor?.interval_seconds ?? 600}
					rangeLabels={["1m", "60m"]}
				/>

				<Field label={t("status.label")} description={t("status.description")}>
					<Select name="expected_status">
						{EXPECTED_STATUS_CODES.map((status) => (
							<Select.Option
								key={status.value}
								value={status.value}
								selected={status.value === expectedStatus}
							>
								{status.label}
							</Select.Option>
						))}
					</Select>
				</Field>

				<Field label={t("region.label")} description={t("region.description")}>
					<Select name="location_hint" required defaultValue={locationHint ?? ""}>
						{!locationHint && (
							<Select.Option value="" disabled selected>
								{t("region.placeholder")}
							</Select.Option>
						)}
						{LOCATION_HINTS.map((hint) => (
							<Select.Option key={hint} value={hint} selected={hint === locationHint}>
								{t(`region.options.${hint}`, { emoji: LOCATION_HINT_EMOJI[hint] })}
							</Select.Option>
						))}
					</Select>
				</Field>
			</>
		);
	};
}
