/**
 * StateMessage view for the gallery. It renders error and empty states inside the
 * shared Shell as an alert region with a title, message, and a link back to the album
 * index. It gives every controller one consistent way to surface load failures or
 * missing data to the user.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import { ActionLink } from "../components/action-link";
import { Shell } from "../components/shell";
import { routes } from "../routes";

/**
 * Props for error and empty states.
 */
export interface StateMessageProps {
	title: string;
	message: string;
}

/**
 * Renders an error or empty data state inside the shared shell.
 *
 * @param handle Component handle carrying user-facing state copy.
 * @returns A route-level state message.
 */
export function StateMessage(handle: Handle<StateMessageProps>) {
	return () => (
		<Shell
			eyebrow="Gallery state"
			title={handle.props.title}
			intro="The demo app could not render the requested route."
		>
			<section
				mix={css({
					boxSizing: "border-box",
					padding: "2rem",
					border: "1px solid rgb(154 52 18 / 0.16)",
					borderRadius: "1.5rem",
					background: "rgb(255 255 255 / 0.68)",
				})}
				role="alert"
				aria-labelledby="state-title"
			>
				<h2
					mix={css({
						marginBlockStart: 0,
						fontFamily: 'Georgia, "Times New Roman", serif',
						fontSize: "2rem",
						fontWeight: 500,
					})}
					id="state-title"
				>
					{handle.props.title}
				</h2>
				<p mix={css({ color: "#6b4f43" })}>{handle.props.message}</p>
				<ActionLink href={routes.home.href()}>Return to albums</ActionLink>
			</section>
		</Shell>
	);
}
