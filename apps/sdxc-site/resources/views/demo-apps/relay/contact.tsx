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

import type { Contact, Conversation } from "~/resources/views/demo-apps/relay/data";

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

/** Renders the contact's page. */
export function ContactScreen(handle: Handle<ContactScreen.Props>) {
	return () => {
		let { contact, collapsed } = handle.props;
		let company = findCompany(contact.companyId);
		let plan = planOf(contact);
		let conversations = conversationsOf(contact.id);

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
								<ul
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
										return (
											<li
												mix={[index === 0 ? [] : borderEdge("top", { width: 1, color: "neutral" })]}
											>
												<a
													href={href(`${mailboxOf(conversation)}/${conversation.id}`)}
													mix={[
														hstack({ gap: 3, align: "center" }),
														pi(4),
														pb(3),
														fg("neutral.emphasis"),
														raw({ textDecoration: "none" }),
														hover(bg("neutral.bg-tint-hover")),
													]}
												>
													<span
														mix={[
															truncate(),
															text("sm"),
															weight("medium"),
															raw({ flex: "1 1 auto" }),
														]}
													>
														{conversation.subject}
													</span>
													<Badge variant="secondary" color={status.color}>
														{status.label}
													</Badge>
													<span mix={[text("xs"), fg("neutral.muted")]}>
														<RelativeTime date={updatedAt(conversation)} now={NOW} locale="en" />
													</span>
												</a>
											</li>
										);
									})}
								</ul>
							</Block>
							<Block title="Activity">
								<ContactActivity contact={contact} />
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
