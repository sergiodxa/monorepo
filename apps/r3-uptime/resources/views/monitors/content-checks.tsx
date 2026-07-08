/**
 * Content checks section, shown on the monitor edit page: the monitor's existing
 * checks (each with a delete confirmation) plus a form to add a new one. Posts to
 * the `create-content-check`/`delete-content-check` actions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { SelectMonitorContentCheck } from "~/database/schema";

import * as s from "~/resources/styles";
import routes from "~/routes/web";

namespace ContentChecksSection {
	export interface Props {
		team: { slug: string };
		monitorId: string;
		contentChecks: SelectMonitorContentCheck[];
	}
}

const TYPE_LABELS: Record<SelectMonitorContentCheck["type"], string> = {
	contains: "Contains",
	not_contains: "Does not contain",
	regex: "Matches regex",
};

export default function ContentChecksSection(handle: Handle<ContentChecksSection.Props>) {
	return () => {
		let { team, monitorId, contentChecks } = handle.props;
		let deleteAction = routes.actions.deleteContentCheck.href({ team: team.slug });

		return (
			<div>
				<h2>Content checks</h2>
				<p mix={[s.mutedSmall]}>
					Up to 10 checks. Every enabled check must pass for the response to count as a match.
				</p>

				{contentChecks.length > 0 && (
					<table mix={[s.table]}>
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
											mix={[s.buttonDanger]}
										>
											Delete
										</button>

										<dialog id={`delete-content-check-${check.id}`} mix={[s.dialog]}>
											<h3>Delete this content check?</h3>
											<form method="post" action={deleteAction}>
												<input type="hidden" name="content_check_id" value={check.id} />
												<input type="hidden" name="monitor_id" value={monitorId} />
												<button
													type="button"
													commandfor={`delete-content-check-${check.id}`}
													command="close"
													mix={[s.buttonSecondary]}
												>
													Cancel
												</button>
												<button type="submit" mix={[s.buttonDanger]}>
													Delete
												</button>
											</form>
										</dialog>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}

				<form method="post" action={routes.actions.createContentCheck.href({ team: team.slug })}>
					<input type="hidden" name="monitor_id" value={monitorId} />

					<label mix={[s.field]}>
						<span>Type</span>
						<select name="type" defaultValue="contains" mix={[s.selectInput]}>
							<option value="contains">Contains</option>
							<option value="not_contains">Does not contain</option>
							<option value="regex">Matches regex</option>
						</select>
					</label>

					<label mix={[s.field]}>
						<span>Value</span>
						<input type="text" name="value" required mix={[s.input]} />
					</label>

					<label mix={[s.checkboxField]}>
						<input type="checkbox" name="case_sensitive" value="true" />
						<span>Case sensitive</span>
					</label>

					<button type="submit" mix={[s.buttonSecondary]}>
						Add content check
					</button>
				</form>
			</div>
		);
	};
}
