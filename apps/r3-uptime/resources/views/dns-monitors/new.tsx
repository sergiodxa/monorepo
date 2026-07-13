/**
 * New DNS monitor form page. Posts to the `create-dns-monitor` action.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import { neutral } from "~/resources/theme";
import DnsMonitorFormFields from "~/resources/views/dns-monitors/form";
import routes from "~/routes/web";

namespace NewDnsMonitorView {
	export interface Props {
		team: { slug: string };
	}
}

export default function NewDnsMonitorView(handle: Handle<NewDnsMonitorView.Props>) {
	return () => (
		<div>
			<form
				method="post"
				action={routes.actions.monitor.dns.create.href({ team: handle.props.team.slug })}
			>
				<DnsMonitorFormFields />
				<button
					type="submit"
					mix={[
						css({
							display: "inline-flex",
							alignItems: "center",
							justifyContent: "center",
							padding: "8px 16px",
							borderRadius: 6,
							border: "1px solid transparent",
							background: neutral[900],
							color: "#ffffff",
							fontFamily: "inherit",
							fontSize: "0.875rem",
							fontWeight: 500,
							cursor: "pointer",
							textDecoration: "none",
							"&:hover": { background: neutral[800] },
						}),
					]}
				>
					Create DNS monitor
				</button>
			</form>
		</div>
	);
}
