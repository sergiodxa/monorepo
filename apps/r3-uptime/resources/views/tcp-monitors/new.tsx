/**
 * New TCP monitor form page. Posts to the `create-tcp-monitor` action.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import TcpMonitorFormFields from "~/resources/views/tcp-monitors/form";
import routes from "~/routes/web";

namespace NewTcpMonitorView {
	export interface Props {
		team: { slug: string };
	}
}

export default function NewTcpMonitorView(handle: Handle<NewTcpMonitorView.Props>) {
	return () => (
		<div>
			<h1 mix={[css({ margin: "0 0 24px" })]}>New TCP monitor</h1>
			<form
				method="post"
				action={routes.actions.createTcpMonitor.href({ team: handle.props.team.slug })}
			>
				<TcpMonitorFormFields />
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
							background: "oklch(0.24 0.005 145)",
							color: "#ffffff",
							fontFamily: "inherit",
							fontSize: "0.875rem",
							fontWeight: 500,
							cursor: "pointer",
							textDecoration: "none",
							"&:hover": { background: "oklch(0.32 0.006 145)" },
						}),
					]}
				>
					Create TCP monitor
				</button>
			</form>
		</div>
	);
}
