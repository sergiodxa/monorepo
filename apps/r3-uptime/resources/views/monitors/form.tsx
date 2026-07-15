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
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { getContext } from "remix/async-context-middleware";
import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type { SelectMonitor } from "~/database/schema";

import Field from "~/resources/components/field";
import RangeSlider from "~/resources/components/range-slider";
import { mixForSelect } from "~/resources/mix-for-select";
import { neutral } from "~/resources/theme";

const LOCATION_HINTS = [
	{ value: "wnam", label: "Western North America" },
	{ value: "enam", label: "Eastern North America" },
	{ value: "sam", label: "South America" },
	{ value: "weur", label: "Western Europe" },
	{ value: "eeur", label: "Eastern Europe" },
	{ value: "apac", label: "Asia-Pacific" },
	{ value: "oc", label: "Oceania" },
	{ value: "afr", label: "Africa" },
	{ value: "me", label: "Middle East" },
] as const;

/** Common HTTP status codes a healthy endpoint might return. */
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
				<Field label={t("name.label")} description={t("name.description")}>
					<input
						type="text"
						name="name"
						required
						defaultValue={monitor?.name}
						placeholder={t("name.placeholder")}
						mix={[
							css({
								padding: "8px 12px",
								borderRadius: 6,
								border: `1px solid ${neutral[200]}`,
								fontSize: "0.875rem",
								fontFamily: "inherit",
								background: neutral[50],
								color: "inherit",
								"@media (prefers-color-scheme: dark)": {
									borderColor: neutral[700],
									background: neutral[900],
								},
							}),
						]}
					/>
				</Field>

				<Field label={t("url.label")} description={t("url.description")}>
					<input
						type="url"
						name="url"
						required
						defaultValue={monitor?.url}
						placeholder={t("url.placeholder")}
						mix={[
							css({
								padding: "8px 12px",
								borderRadius: 6,
								border: `1px solid ${neutral[200]}`,
								fontSize: "0.875rem",
								fontFamily: "inherit",
								background: neutral[50],
								color: "inherit",
								"@media (prefers-color-scheme: dark)": {
									borderColor: neutral[700],
									background: neutral[900],
								},
							}),
						]}
					/>
				</Field>

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
					<select
						name="expected_status"
						mix={[
							mixForSelect(
								css({
									padding: "8px 12px",
									borderRadius: 6,
									border: `1px solid ${neutral[200]}`,
									fontSize: "0.875rem",
									fontFamily: "inherit",
									background: neutral[50],
									color: "inherit",
									"@media (prefers-color-scheme: dark)": {
										borderColor: neutral[700],
										background: neutral[900],
									},
								}),
							),
						]}
					>
						{EXPECTED_STATUS_CODES.map((status) => (
							<option
								key={status.value}
								value={status.value}
								selected={status.value === expectedStatus}
							>
								{status.label}
							</option>
						))}
					</select>
				</Field>

				<Field label={t("region.label")} description={t("region.description")}>
					<select
						name="location_hint"
						required
						defaultValue={locationHint ?? ""}
						mix={[
							mixForSelect(
								css({
									padding: "8px 12px",
									borderRadius: 6,
									border: `1px solid ${neutral[200]}`,
									fontSize: "0.875rem",
									fontFamily: "inherit",
									background: neutral[50],
									color: "inherit",
									"@media (prefers-color-scheme: dark)": {
										borderColor: neutral[700],
										background: neutral[900],
									},
								}),
							),
						]}
					>
						{!locationHint && (
							<option value="" disabled selected>
								{t("region.placeholder")}
							</option>
						)}
						{LOCATION_HINTS.map((hint) => (
							<option key={hint.value} value={hint.value} selected={hint.value === locationHint}>
								{hint.label}
							</option>
						))}
					</select>
				</Field>
			</>
		);
	};
}
