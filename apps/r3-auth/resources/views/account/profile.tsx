/**
 * The read-only profile page: the subject's avatar and identity at the top of a card,
 * their display name, username and email address beneath it as a description list, and
 * a link to the form that changes them. The email address is shown but not editable —
 * it is the identifier every relying party keys on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { Avatar, Badge, Card, Heading, LinkButton, Text } from "@pkg/r3-ui";
import { fg } from "@pkg/u/color";
import { flex, flexCol, gap, items } from "@pkg/u/layout";
import { m, mis } from "@pkg/u/size";
import { text, weight } from "@pkg/u/typography";

import routes from "~/routes/web";

namespace ProfileView {
	/** One labelled value of the profile description list. */
	export interface Detail {
		label: string;
		value: string;
	}

	export interface Props {
		/** Card heading. */
		title: string;
		/** The subject's own name, shown beside their avatar. */
		displayName: string;
		/** The subject's handle, rendered with a leading `@`. */
		username: string;
		/** Absolute URL of the subject's avatar image. */
		avatar: string;
		/** The subject's role, shown as a badge so an admin can see they are one. */
		role: string;
		/** Display name, username and email address, in the order they are listed. */
		details: Detail[];
		/** Label of the link to the edit form. */
		editLabel: string;
	}
}

/** Renders the signed-in subject's profile as a card with a link to edit it. */
export default function ProfileView(handle: Handle<ProfileView.Props>) {
	return () => {
		let { title, displayName, username, avatar, role, details, editLabel } = handle.props;

		return (
			<Card>
				<Card.Header>
					<Card.Title>{title}</Card.Title>
				</Card.Header>

				<Card.Content mix={[flex(), flexCol(), gap(6)]}>
					<div mix={[flex(), items("center"), gap(4)]}>
						<Avatar size="lg">
							{/* The fallback is what shows while the image is unreachable, which is
							common enough for an avatar hosted by whoever the person signed in with. */}
							<Avatar.Image src={avatar} alt={displayName} />
							<Avatar.Fallback>{displayName.slice(0, 2).toUpperCase()}</Avatar.Fallback>
						</Avatar>

						<div mix={[flex(), flexCol(), gap(1)]}>
							<Heading level={2} mix={[m(0), text("xl"), weight("semibold")]}>
								{displayName}
							</Heading>
							<Text mix={[fg("neutral.muted")]}>@{username}</Text>
						</div>

						<Badge color="brand" variant="secondary" mix={[mis("auto")]}>
							{role}
						</Badge>
					</div>

					<dl mix={[m(0), flex(), flexCol(), gap(4)]}>
						{details.map((detail) => (
							<div key={detail.label} mix={[flex(), flexCol(), gap(1)]}>
								<dt mix={[text("sm"), weight("medium"), fg("neutral.muted")]}>{detail.label}</dt>
								<dd mix={[m(0), fg("neutral.emphasis")]}>{detail.value}</dd>
							</div>
						))}
					</dl>
				</Card.Content>

				<Card.Footer>
					<LinkButton href={routes.account.profileEdit.index.href()} color="brand">
						{editLabel}
					</LinkButton>
				</Card.Footer>
			</Card>
		);
	};
}
