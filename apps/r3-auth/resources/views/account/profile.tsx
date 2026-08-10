/**
 * The read-only profile page: the subject's avatar and identity at the top of a card,
 * their display name, username and email address beneath it as a description list, and
 * a link to the form that changes them. The email address is shown but not editable —
 * it is the identifier every relying party keys on.
 *
 * It is also where an unconfirmed address is surfaced: a badge beside the address so the
 * state is visible at a glance, and, while it is unconfirmed, a panel that says what that
 * costs and posts a request for a fresh verification message. Without both, "unverified"
 * would be a fact only relying parties can see.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { fg } from "@pkg/u/color";
import { flex, flexCol, gap, items } from "@pkg/u/layout";
import { m, mis } from "@pkg/u/size";
import { text, weight } from "@pkg/u/typography";
import { Alert, Avatar, Badge, Button, Card, Form, Heading, LinkButton, Text } from "@pkg/ui";

import type { EmailVerificationViewModel } from "~/app/http/view-models/email-verification";

import routes from "~/routes/web";

namespace ProfileView {
	/** One labelled value of the profile description list. */
	export interface Detail {
		label: string;
		value: string;
		/**
		 * A state badge rendered beside the value, when the value has one.
		 *
		 * `verified` picks the tone rather than the caller naming a colour, so "confirmed" is
		 * never accidentally rendered in the tone that means the opposite.
		 */
		badge?: { label: string; verified: boolean };
	}

	export interface Props {
		/**
		 * The address's verification state, its badge, and the resend panel's copy.
		 *
		 * The badge is attached to whichever detail is flagged; the panel renders only while
		 * the address is unconfirmed.
		 */
		emailVerification: EmailVerificationViewModel.Output;
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
		let { title, displayName, username, avatar, role, details, editLabel, emailVerification } =
			handle.props;

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
								<dd mix={[m(0), flex(), items("center"), gap(2), fg("neutral.emphasis")]}>
									{detail.value}
									{detail.badge ? (
										<Badge
											color={detail.badge.verified ? "success" : "warning"}
											variant="secondary"
										>
											{detail.badge.label}
										</Badge>
									) : null}
								</dd>
							</div>
						))}
					</dl>

					{emailVerification.verified ? null : (
						<Alert color="warning">
							<Alert.Content>
								<Alert.Title>{emailVerification.title}</Alert.Title>
								<Alert.Description>{emailVerification.description}</Alert.Description>
								{emailVerification.notice ? (
									<Alert.Description>{emailVerification.notice}</Alert.Description>
								) : null}
							</Alert.Content>

							<Alert.Action>
								{/* A form rather than a link: it sends mail, so it must not be reachable by
								anything that follows a URL — a prefetch, a crawler or a history restore. */}
								<Form method="post" action={emailVerification.actionHref}>
									<Button type="submit" color="brand">
										{emailVerification.action}
									</Button>
								</Form>
							</Alert.Action>
						</Alert>
					)}
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
