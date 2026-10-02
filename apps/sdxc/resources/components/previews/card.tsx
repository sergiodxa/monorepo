/**
 * Live preview island for `Card`. The panel supplies the frame, the tint a `color` picks
 * and the spacing between its header, body and footer; what goes in each slot is the
 * page's. Two panels side by side show the part that matters — the same structure reading
 * as a neutral summary and as a tinted alarm.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { GitBranchIcon, TriangleAlertIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { flexWrap, hstack, vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Badge, Button, Card, Separator } from "@sdxc/ui";
import { clientEntry } from "remix/component";

/** The source the page shows, matching the markup below. */
const CODE = `<div mix={[hstack({ gap: 4, align: "stretch" }), flexWrap()]}>
	<Card mix={[is("22rem")]}>
		<Card.Header>
			<Card.Title>acme-web</Card.Title>
			<Card.Description>Production · deployed 12 minutes ago</Card.Description>
		</Card.Header>
		<Card.Content mix={[vstack({ gap: 3, align: "stretch" })]}>
			<div mix={[hstack({ gap: 2, align: "center" })]}>
				<Badge color="success" variant="secondary">
					Healthy
				</Badge>
				<span mix={[hstack({ gap: 1, align: "center" }), text("sm"), fg("neutral")]}>
					<GitBranchIcon size={14} aria-hidden="true" />
					main@4f9c1ab
				</span>
			</div>
			<Separator />
			<dl mix={[hstack({ gap: 6, align: "start" })]}>
				<div mix={[vstack({ gap: 1, align: "start" })]}>
					<dt mix={[text("xs"), fg("neutral.muted")]}>Requests</dt>
					<dd mix={[text("lg"), weight("semibold")]}>1.2M</dd>
				</div>
				<div mix={[vstack({ gap: 1, align: "start" })]}>
					<dt mix={[text("xs"), fg("neutral.muted")]}>p95</dt>
					<dd mix={[text("lg"), weight("semibold")]}>84ms</dd>
				</div>
				<div mix={[vstack({ gap: 1, align: "start" })]}>
					<dt mix={[text("xs"), fg("neutral.muted")]}>Errors</dt>
					<dd mix={[text("lg"), weight("semibold")]}>0.02%</dd>
				</div>
			</dl>
		</Card.Content>
		<Card.Footer mix={[hstack({ gap: 2, align: "center" })]}>
			<Button type="button" size="sm">
				Open logs
			</Button>
			<Button type="button" size="sm" variant="outline" color="neutral">
				Roll back
			</Button>
		</Card.Footer>
	</Card>

	<Card color="danger" mix={[is("20rem")]}>
		<Card.Header>
			<Card.Title mix={[hstack({ gap: 2, align: "center" })]}>
				<TriangleAlertIcon size={18} aria-hidden="true" />
				Checkout latency
			</Card.Title>
			<Card.Description>Incident INC-4821 · opened 06:14 UTC</Card.Description>
		</Card.Header>
		<Card.Content>
			p95 on /checkout has held above 2s for 18 minutes. The payments queue is draining at
			half its usual rate.
		</Card.Content>
		<Card.Footer>
			<Button type="button" size="sm" color="danger">
				Page on-call
			</Button>
		</Card.Footer>
	</Card>
</div>`;

/** A deployment summary beside a tinted incident panel, hydrated the way every preview here loads. */
export const CardPreview = clientEntry(
	"/resources/components/previews/card.tsx#CardPreview",
	function CardPreview() {
		return () => (
			<div mix={[hstack({ gap: 4, align: "stretch" }), flexWrap()]}>
				<Card mix={[is("22rem")]}>
					<Card.Header>
						<Card.Title>acme-web</Card.Title>
						<Card.Description>Production · deployed 12 minutes ago</Card.Description>
					</Card.Header>
					<Card.Content mix={[vstack({ gap: 3, align: "stretch" })]}>
						<div mix={[hstack({ gap: 2, align: "center" })]}>
							<Badge color="success" variant="secondary">
								Healthy
							</Badge>
							<span mix={[hstack({ gap: 1, align: "center" }), text("sm"), fg("neutral")]}>
								<GitBranchIcon size={14} aria-hidden="true" />
								main@4f9c1ab
							</span>
						</div>
						<Separator />
						<dl mix={[hstack({ gap: 6, align: "start" })]}>
							<div mix={[vstack({ gap: 1, align: "start" })]}>
								<dt mix={[text("xs"), fg("neutral.muted")]}>Requests</dt>
								<dd mix={[text("lg"), weight("semibold")]}>1.2M</dd>
							</div>
							<div mix={[vstack({ gap: 1, align: "start" })]}>
								<dt mix={[text("xs"), fg("neutral.muted")]}>p95</dt>
								<dd mix={[text("lg"), weight("semibold")]}>84ms</dd>
							</div>
							<div mix={[vstack({ gap: 1, align: "start" })]}>
								<dt mix={[text("xs"), fg("neutral.muted")]}>Errors</dt>
								<dd mix={[text("lg"), weight("semibold")]}>0.02%</dd>
							</div>
						</dl>
					</Card.Content>
					<Card.Footer mix={[hstack({ gap: 2, align: "center" })]}>
						<Button type="button" size="sm">
							Open logs
						</Button>
						<Button type="button" size="sm" variant="outline" color="neutral">
							Roll back
						</Button>
					</Card.Footer>
				</Card>

				<Card color="danger" mix={[is("20rem")]}>
					<Card.Header>
						<Card.Title mix={[hstack({ gap: 2, align: "center" })]}>
							<TriangleAlertIcon size={18} aria-hidden="true" />
							Checkout latency
						</Card.Title>
						<Card.Description>Incident INC-4821 · opened 06:14 UTC</Card.Description>
					</Card.Header>
					<Card.Content>
						p95 on /checkout has held above 2s for 18 minutes. The payments queue is draining at
						half its usual rate.
					</Card.Content>
					<Card.Footer>
						<Button type="button" size="sm" color="danger">
							Page on-call
						</Button>
					</Card.Footer>
				</Card>
			</div>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: CODE, render: () => <CardPreview /> };
