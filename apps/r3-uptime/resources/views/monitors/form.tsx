/**
 * Shared HTTP monitor form fields, used by both the new-monitor and edit-monitor
 * views. Renders name/URL/method/expected-status/interval/timeout/degraded-threshold/
 * location-hint inputs pre-filled from `handle.props.monitor` when editing. SSL
 * settings are a separate form/action (see `ssl-form.tsx`). It exists so the two
 * pages don't duplicate the field markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CSSMixinDescriptor, ElementProps, Handle, MixinDescriptor } from "remix/ui";

import { css } from "remix/ui";

import type { SelectMonitor } from "~/database/schema";

import Field from "~/resources/components/field";
import RangeSlider from "~/resources/components/range-slider";
import { neutral } from "~/resources/theme";

/** {@link mixForSelect} re-types a `css()` mixin for `<select>`. */
function mixForSelect(
	mixin: CSSMixinDescriptor,
): MixinDescriptor<HTMLSelectElement, CSSMixinDescriptor["args"], ElementProps> {
	return mixin as unknown as MixinDescriptor<
		HTMLSelectElement,
		CSSMixinDescriptor["args"],
		ElementProps
	>;
}

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"] as const;

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

const input = css({
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
});

namespace MonitorFormFields {
	export interface Props {
		/** Existing monitor values when editing; omitted when creating. */
		monitor?: SelectMonitor;
	}
}

/** Renders the URL/method/expected-status/interval/timeout/degraded-threshold/region fields, pre-filled from `monitor` when editing and defaulted to a HEAD check expecting status 200 when creating. */
export default function MonitorFormFields(handle: Handle<MonitorFormFields.Props>) {
	return () => {
		let monitor = handle.props.monitor;
		let method = monitor?.method ?? "HEAD";
		let expectedStatus = monitor?.expected_status ?? 200;
		let locationHint = monitor?.location_hint ?? "wnam";

		return (
			<>
				<Field label="Name" description="Shown across your dashboard and in alert notifications.">
					<input type="text" name="name" required defaultValue={monitor?.name} mix={[input]} />
				</Field>

				<Field label="URL" description="The endpoint we check on each run.">
					<input
						type="url"
						name="url"
						required
						defaultValue={monitor?.url}
						placeholder="https://example.com"
						mix={[input]}
					/>
				</Field>

				<Field
					label="Method"
					description="The HTTP method used for the check request. HEAD is fastest for simple uptime checks."
				>
					<select name="method" mix={[mixForSelect(input)]}>
						{HTTP_METHODS.map((value) => (
							<option key={value} value={value} selected={value === method}>
								{value}
							</option>
						))}
					</select>
				</Field>

				<Field
					label="Expected status code"
					description="The response status code that counts as this endpoint being healthy."
				>
					<select name="expected_status" mix={[mixForSelect(input)]}>
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

				<RangeSlider
					label="Check interval"
					description="How often we run this check, from every minute up to once an hour."
					name="interval_seconds"
					min={60}
					max={3600}
					step={60}
					scale={60}
					unit="m"
					defaultValue={monitor?.interval_seconds ?? 60}
					rangeLabels={["1m", "60m"]}
				/>

				<Field
					label="Timeout (seconds)"
					description="How long to wait for a response before treating the check as failed."
				>
					<input
						type="number"
						name="timeout_seconds"
						min={1}
						max={60}
						defaultValue={monitor?.timeout_seconds ?? 10}
						mix={[input]}
					/>
				</Field>

				<Field
					label="Degraded threshold (ms)"
					description="Response times above this threshold are marked as degraded instead of healthy."
				>
					<input
						type="number"
						name="degraded_after_ms"
						min={1}
						max={60_000}
						defaultValue={monitor?.degraded_after_ms ?? 5000}
						mix={[input]}
					/>
				</Field>

				<Field
					label="Check region"
					description="The Cloudflare network region used to run the check, useful for testing regional latency."
				>
					<select name="location_hint" mix={[mixForSelect(input)]}>
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
