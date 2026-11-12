/**
 * One contact's own page in Relay: their conversations and history in the main column and
 * their facts in a properties column, for the times a person spends long enough on one
 * customer that a peek sheet is too small.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { bg, border, borderEdge, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { listStyle, raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { atQuery } from "@sdxc/u/responsive";
import { m, p, pb, pi } from "@sdxc/u/size";
import { hover } from "@sdxc/u/state";
import { text, truncate, weight } from "@sdxc/u/typography";
import { Badge, LinkButton, RelativeTime } from "@sdxc/ui";
import { PageHeader } from "@sdxc/ui/app/page-header";
import { Skeleton } from "@sdxc/ui/app/skeleton";

import type { Contact, Conversation } from "~/resources/views/demo-apps/relay/data";

import DemoAppFrame from "~/resources/views/demo-apps/frame";
import { ContactActivity, ContactProperties } from "~/resources/views/demo-apps/relay/contacts";
import {
	NOW,
	conversationsOf,
	findCompany,
	planOf,
	updatedAt,
} from "~/resources/views/demo-apps/relay/data";
import { RelayShell } from "~/resources/views/demo-apps/relay/shell";
import { href } from "~/resources/views/demo-apps/relay/views";

namespace ContactScreen {
	export interface Props {
		contact: Contact;
		collapsed: boolean;
	}
}

/** The status word and tone a conversation's row carries. */
function statusOf(conversation: Conversation): { label: string; color: "brand" | "neutral" } {
	if (conversation.status === "open") return { label: "Open", color: "brand" };
	if (conversation.status === "snoozed") return { label: "Snoozed", color: "neutral" };
	return { label: "Archived", color: "neutral" };
}

/** The mailbox a conversation opens in, so its link lands beside the list holding it. */
function mailboxOf(conversation: Conversation): string {
	if (conversation.status === "snoozed") return "snoozed";
	if (conversation.status === "archived") return "archived";
	return "inbox";
}

/** A titled block of the main column. */
function Block(handle: Handle<{ title: string; children: RemixNode }>) {
	return () => (
		<section mix={[vstack({ gap: 3, align: "stretch" })]}>
			<h2 mix={[m(0), text("sm"), weight("semibold"), fg("neutral.emphasis")]}>
				{handle.props.title}
			</h2>
			{handle.props.children}
		</section>
	);
}

/**
 * The contact's conversations, newest first, each linking to the mailbox that holds it: the
 * page's `contacts/<id>/conversations` frame. As a ghost it is the frame's placeholder, the
 * same one-line rows drawn as bars.
 */
export function ContactConversations(handle: Handle<{ contact: Contact; ghost?: boolean }>) {
	return () => {
		let { contact, ghost = false } = handle.props;
		let conversations = conversationsOf(contact.id);
		let shown = (node: RemixNode) => (ghost ? <Skeleton.Text>{node}</Skeleton.Text> : node);
		let rowMix = [
			hstack({ gap: 3, align: "center" }),
			pi(4),
			pb(3),
			fg("neutral.emphasis"),
			raw({ textDecoration: "none" }),
		];

		return (
			<ul
				aria-hidden={ghost ? "true" : undefined}
				mix={[
					m(0),
					p(0),
					listStyle(),
					rounded("lg"),
					border({ color: "neutral.border", width: 1 }),
					raw({ overflow: "hidden" }),
				]}
			>
				{conversations.map((conversation, index) => {
					let status = statusOf(conversation);
					let badge = (
						<Badge variant="secondary" color={status.color}>
							{status.label}
						</Badge>
					);
					let row = (
						<>
							<span mix={[truncate(), text("sm"), weight("medium"), raw({ flex: "1 1 auto" })]}>
								{shown(conversation.subject)}
							</span>
							{ghost ? <Skeleton.Text block>{badge}</Skeleton.Text> : badge}
							<span mix={[text("xs"), fg("neutral.muted")]}>
								{shown(<RelativeTime date={updatedAt(conversation)} now={NOW} locale="en" />)}
							</span>
						</>
					);
					return (
						<li mix={[index === 0 ? [] : borderEdge("top", { width: 1, color: "neutral" })]}>
							{ghost ? (
								<div mix={rowMix}>{row}</div>
							) : (
								<a
									href={href(`${mailboxOf(conversation)}/${conversation.id}`)}
									mix={[...rowMix, hover(bg("neutral.bg-tint-hover"))]}
								>
									{row}
								</a>
							)}
						</li>
					);
				})}
			</ul>
		);
	};
}

/** Renders the contact's page. */
export function ContactScreen(handle: Handle<ContactScreen.Props>) {
	return () => {
		let { contact, collapsed } = handle.props;
		let company = findCompany(contact.companyId);
		let plan = planOf(contact);

		return (
			<RelayShell current="contacts" collapsed={collapsed} crumb="Contacts">
				<div mix={[vstack({ gap: 6, align: "stretch" })]}>
					<PageHeader
						crumbs={[{ label: "Contacts", href: href("contacts") }, { label: contact.name }]}
						crumbsLabel="Breadcrumb"
						parent={{ href: href("contacts"), label: "Contacts" }}
						title={contact.name}
						description={`${contact.title} at ${company?.name ?? "an unknown company"}`}
						status={
							<Badge variant="secondary" color={plan === "Enterprise" ? "brand" : "neutral"}>
								{plan}
							</Badge>
						}
						actions={
							<LinkButton
								href={href(`contacts?contact=${contact.id}`)}
								variant="outline"
								color="neutral"
								size="sm"
							>
								Show in list
							</LinkButton>
						}
					/>
					<div
						mix={[
							raw({ display: "grid", gap: "2rem", gridTemplateColumns: "minmax(0, 1fr)" }),
							atQuery(
								"ui-app-content (min-width: 52rem)",
								raw({ gridTemplateColumns: "minmax(0, 1fr) 18rem" }),
							),
						]}
					>
						<div mix={[vstack({ gap: 8, align: "stretch" })]}>
							<Block title="Conversations">
								<DemoAppFrame
									app="relay"
									part={`contacts/${contact.id}/conversations`}
									fallback={<ContactConversations contact={contact} ghost />}
								/>
							</Block>
							<Block title="Activity">
								<DemoAppFrame
									app="relay"
									part={`contacts/${contact.id}/activity`}
									fallback={<ContactActivity contact={contact} ghost />}
								/>
							</Block>
						</div>
						<aside aria-label="Details" mix={[vstack({ gap: 3, align: "stretch" })]}>
							<h2 mix={[m(0), text("sm"), weight("semibold"), fg("neutral.emphasis")]}>Details</h2>
							<ContactProperties contact={contact} />
						</aside>
					</div>
				</div>
			</RelayShell>
		);
	};
}
