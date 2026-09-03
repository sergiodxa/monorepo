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

import { Alert, LinkButton } from "@sdxc/ui";

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
			<Alert color="danger">
				<Alert.Content>
					<Alert.Title>{handle.props.title}</Alert.Title>
					<Alert.Description>{handle.props.message}</Alert.Description>
				</Alert.Content>
				<Alert.Action>
					<LinkButton href={routes.home.href()} color="danger" variant="outline" size="sm">
						Return to albums
					</LinkButton>
				</Alert.Action>
			</Alert>
		</Shell>
	);
}
