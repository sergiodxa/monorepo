/**
 * The CMS Webmention moderation page: tabs for the pending, approved and rejected
 * queues, and per mention its source, what it said, and the decisions a moderator can
 * take, including allowing or blocking the whole source host.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { listStyle } from "@sdxc/u/general";
import { flexWrap, gap, grid, hstack } from "@sdxc/u/layout";
import { m, minIs, p } from "@sdxc/u/size";
import { overflowWrap, text } from "@sdxc/u/typography";
import { Badge, Button, Heading, Link, NavLink } from "@sdxc/ui";

import { CMSLayout } from "~/resources/layouts/cms";
import routes from "~/routes/web";

/** Types used by the moderation page. */
export namespace CMSWebmentionsView {
	/** A queue a moderator can look at. */
	export type Status = "pending" | "approved" | "rejected";

	/** One mention as the moderation list shows it. */
	export interface Item {
		id: string;
		kind: string;
		source: string;
		sourceHost: string;
		target: string;
		authorName: string | null;
		/** The mention's content as plain text, so a moderator reads it without rendering it. */
		text: string | null;
		updatedAt: string;
		/** Where the decision form posts. */
		action: string;
	}

	/** Data required to render one queue. */
	export interface Model {
		status: Status;
		items: Array<Item>;
	}
}

/** The queue tabs, in the order a moderator works through them. */
const QUEUES: Array<{ status: CMSWebmentionsView.Status; label: string }> = [
	{ status: "pending", label: "Pending" },
	{ status: "approved", label: "Approved" },
	{ status: "rejected", label: "Rejected" },
];

/**
 * The decisions offered in each queue: a pending mention can take any, an approved one
 * can be withdrawn, and a rejected one can be approved after all.
 */
const DECISIONS: Record<
	CMSWebmentionsView.Status,
	Array<{ value: string; label: string; color: "brand" | "neutral" | "danger" }>
> = {
	pending: [
		{ value: "approve", label: "Approve", color: "brand" },
		{ value: "allow", label: "Approve and trust domain", color: "neutral" },
		{ value: "reject", label: "Reject", color: "neutral" },
		{ value: "block", label: "Block domain", color: "danger" },
	],
	approved: [
		{ value: "reject", label: "Reject", color: "neutral" },
		{ value: "block", label: "Block domain", color: "danger" },
	],
	rejected: [
		{ value: "approve", label: "Approve", color: "brand" },
		{ value: "block", label: "Block domain", color: "danger" },
	],
};

/** Builds the moderation page for one queue. */
export function CMSWebmentionsView() {
	return ({ model }: { model: CMSWebmentionsView.Model }) => (
		<CMSLayout title="Webmentions" activePath={routes.cms.webmentions.index.href()}>
			<main mix={[grid(), gap(4)]}>
				<section
					mix={[
						grid(),
						gap(3),
						p(4),
						rounded("lg"),
						border({ width: 1, color: "neutral" }),
						bg("neutral.tint"),
					]}
				>
					<Heading level={2} mix={[m(0)]}>
						Webmentions
					</Heading>
					<nav aria-label="Queues" mix={[hstack({ gap: 2 }), flexWrap("wrap")]}>
						{QUEUES.map((queue) => (
							<NavLink
								key={queue.status}
								href={`${routes.cms.webmentions.index.href()}?status=${queue.status}`}
								color={queue.status === model.status ? "brand" : "neutral"}
								aria-current={queue.status === model.status ? "page" : undefined}
							>
								{queue.label}
							</NavLink>
						))}
					</nav>
				</section>

				<section
					mix={[p(4), rounded("lg"), border({ width: 1, color: "neutral" }), bg("neutral.tint")]}
				>
					{model.items.length === 0 ? (
						<p mix={[m(0), fg("neutral")]}>No mentions in this queue.</p>
					) : (
						<ol mix={[m(0), p(0), listStyle("none"), grid(), gap(4)]}>
							{model.items.map((item) => (
								<li key={item.id} mix={[grid(), gap(2), minIs(0), overflowWrap("anywhere")]}>
									<div mix={[hstack({ gap: 2, align: "center" }), flexWrap("wrap")]}>
										<Badge color="brand" variant="secondary">
											{item.kind}
										</Badge>
										<strong>{item.authorName ?? item.sourceHost}</strong>
										<span mix={[text("sm"), fg("neutral.muted")]}>{item.sourceHost}</span>
									</div>
									<p mix={[m(0), text("sm")]}>
										<Link href={item.source}>{item.source}</Link>
										{" → "}
										<Link href={item.target}>{item.target}</Link>
									</p>
									{item.text && <p mix={[m(0), fg("neutral")]}>{item.text}</p>}
									<form
										method="post"
										action={item.action}
										mix={[hstack({ gap: 2 }), flexWrap("wrap")]}
									>
										<input type="hidden" name="_method" value="PUT" />
										<input type="hidden" name="status" value={model.status} />
										{DECISIONS[model.status].map((decision) => (
											<Button
												key={decision.value}
												type="submit"
												name="decision"
												value={decision.value}
												color={decision.color}
												variant={decision.color === "brand" ? "solid" : "outline"}
												size="sm"
											>
												{decision.label}
											</Button>
										))}
									</form>
								</li>
							))}
						</ol>
					)}
				</section>
			</main>
		</CMSLayout>
	);
}
