/**
 * Shared HTTP monitor form fields for the new-monitor and edit-monitor views,
 * split into a `"basics"` group (name, URL) and a `"checks"` group (interval,
 * expected status, region) that post to one `<form>`. Method, timeout, and
 * the degraded threshold keep their table defaults; SSL settings live in a
 * separate form.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { getContext } from "remix/middleware/async-context";
import type { Handle } from "remix/ui";

import { Select, TextField } from "@pkg/ui";

import type { SelectMonitor } from "~/database/schema";

import Field from "~/resources/components/field";
import { RangeSlider } from "~/resources/components/range-slider";

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

/**
 * Common HTTP status codes a healthy endpoint might return, with their status
 * text left untranslated: a code and its standard reason phrase form a fixed,
 * protocol-defined pairing, closer to an enum label than translatable prose.
 */
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
		/**
		 * Which half of the fields to render: `"basics"` is what gets watched (name,
		 * URL), `"checks"` is how it gets watched (interval, expected status, region).
		 * Both groups post to the same `<form>`.
		 */
		group: "basics" | "checks";
		/**
		 * Starting value for the URL field when creating, for a caller that already knows
		 * which URL the viewer wants watched. Ignored when `monitor` supplies one, since an
		 * edit's own value is never something a query string should be able to replace.
		 */
		defaultUrl?: string;
	}
}

/**
 * Renders the name/URL/check-interval/expected-status/region fields, defaulting
 * to a 10-minute interval and status 200 on create. The region `<select>` marks
 * its saved option `selected` directly since a host `defaultValue` is inert here.
 */
export default function MonitorFormFields(handle: Handle<MonitorFormFields.Props>) {
	return () => {
		let { monitor, i18next, page, group, defaultUrl } = handle.props;
		let t = i18next.getFixedT(null, "translation", `page.${page}.form.fields`);

		let expectedStatus = monitor?.expected_status ?? 200;
		let locationHint = monitor?.location_hint;

		if (group === "basics") {
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
					/>

					<TextField
						label={t("url.label")}
						description={t("url.description")}
						type="url"
						name="url"
						required
						defaultValue={monitor?.url ?? defaultUrl}
						placeholder={t("url.placeholder")}
					/>
				</>
			);
		}

		return (
			<>
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
					<Select name="location_hint" required>
						{!locationHint && (
							<Select.Option value="" disabled selected={!locationHint}>
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
