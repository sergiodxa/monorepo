/**
 * Content checks section, shown on the monitor edit page: the monitor's existing
 * checks (each with a delete confirmation) plus a form to add a new one. Posts to
 * the `create-content-check`/`delete-content-check` actions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CSSMixinDescriptor, ElementProps, Handle, MixinDescriptor } from "remix/ui";

import { css } from "remix/ui";

import type { SelectMonitorContentCheck } from "~/database/schema";

import Field from "~/resources/components/field";
import { danger, neutral } from "~/resources/theme";
import routes from "~/routes/web";

namespace ContentChecksSection {
	export interface Props {
		team: { slug: string };
		monitorId: string;
		contentChecks: SelectMonitorContentCheck[];
	}
}

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

/** Destructive action button. Reused per row. */
const buttonDanger = css({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	padding: "8px 16px",
	borderRadius: 6,
	border: "1px solid transparent",
	background: danger[600],
	color: "#ffffff",
	fontFamily: "inherit",
	fontSize: "0.875rem",
	fontWeight: 500,
	cursor: "pointer",
	textDecoration: "none",
	"&:hover": { background: danger[700] },
});

/** Secondary (outline) button. Reused below. */
const buttonSecondary = css({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	padding: "8px 16px",
	borderRadius: 6,
	border: `2px solid ${neutral[300]}`,
	background: "#ffffff",
	color: neutral[500],
	fontFamily: "inherit",
	fontSize: "0.875rem",
	fontWeight: 500,
	cursor: "pointer",
	textDecoration: "none",
	"&:hover": { background: neutral[50] },
	"@media (prefers-color-scheme: dark)": {
		background: neutral[900],
		color: neutral[400],
		borderColor: neutral[700],
		"&:hover": { background: neutral[800] },
	},
});

const TYPE_LABELS: Record<SelectMonitorContentCheck["type"], string> = {
	contains: "Contains",
	not_contains: "Does not contain",
	regex: "Matches regex",
};

export default function ContentChecksSection(handle: Handle<ContentChecksSection.Props>) {
	return () => {
		let { team, monitorId, contentChecks } = handle.props;
		let deleteAction = routes.actions.monitor.http.deleteContentCheck.href({ team: team.slug });

		return (
			<div>
				<h2>Content checks</h2>
				<p
					mix={[
						css({
							fontSize: "0.8125rem",
							color: neutral[500],
							"@media (prefers-color-scheme: dark)": { color: neutral[400] },
						}),
					]}
				>
					Up to 10 checks. Every enabled check must pass for the response to count as a match.
				</p>

				{contentChecks.length > 0 && (
					<div mix={[css({ overflowX: "auto" })]}>
						<table
							mix={[
								css({
									width: "100%",
									borderCollapse: "collapse",
									fontSize: "0.875rem",
									"& th, & td": {
										textAlign: "left",
										padding: "12px 16px",
										borderBottom: `1px solid ${neutral[200]}`,
									},
									"@media (prefers-color-scheme: dark)": {
										"& th, & td": { borderColor: neutral[800] },
									},
								}),
							]}
						>
							<thead>
								<tr>
									<th>Type</th>
									<th>Value</th>
									<th>Case sensitive</th>
									<th>Status</th>
									<th></th>
								</tr>
							</thead>
							<tbody>
								{contentChecks.map((check) => (
									<tr key={check.id}>
										<td>{TYPE_LABELS[check.type]}</td>
										<td>
											<code>{check.value}</code>
										</td>
										<td>{check.case_sensitive ? "Yes" : "No"}</td>
										<td>{check.is_enabled ? "Enabled" : "Disabled"}</td>
										<td>
											<button
												type="button"
												commandfor={`delete-content-check-${check.id}`}
												command="show-modal"
												mix={[buttonDanger]}
											>
												Delete
											</button>

											<dialog
												id={`delete-content-check-${check.id}`}
												mix={[
													css({
														padding: 24,
														borderRadius: 8,
														border: `1px solid ${neutral[300]}`,
														maxWidth: 400,
														"&::backdrop": { background: "rgba(0, 0, 0, 0.4)" },
														"@media (prefers-color-scheme: dark)": {
															borderColor: neutral[700],
															background: neutral[900],
															color: neutral[50],
														},
													}),
												]}
											>
												<h3>Delete this content check?</h3>
												<form method="post" action={deleteAction}>
													<input type="hidden" name="_method" value="DELETE" />
													<input type="hidden" name="content_check_id" value={check.id} />
													<input type="hidden" name="monitor_id" value={monitorId} />
													<button
														type="button"
														commandfor={`delete-content-check-${check.id}`}
														command="close"
														mix={[buttonSecondary]}
													>
														Cancel
													</button>
													<button type="submit" mix={[buttonDanger]}>
														Delete
													</button>
												</form>
											</dialog>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}

				<form
					method="post"
					action={routes.actions.monitor.http.createContentCheck.href({ team: team.slug })}
				>
					<input type="hidden" name="monitor_id" value={monitorId} />

					<Field label="Type">
						<select
							name="type"
							defaultValue="contains"
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
							<option value="contains">Contains</option>
							<option value="not_contains">Does not contain</option>
							<option value="regex">Matches regex</option>
						</select>
					</Field>

					<Field label="Value">
						<input
							type="text"
							name="value"
							required
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

					<label
						mix={[
							css({
								display: "flex",
								alignItems: "center",
								gap: 8,
								marginBottom: 16,
								fontSize: "0.875rem",
							}),
						]}
					>
						<input type="checkbox" name="case_sensitive" value="true" />
						<span>Case sensitive</span>
					</label>

					<button type="submit" mix={[buttonSecondary]}>
						Add content check
					</button>
				</form>
			</div>
		);
	};
}
