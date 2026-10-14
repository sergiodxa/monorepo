/**
 * The live strip the `@sdxc/ui` overview opens beside its pitch: a handful of real
 * components arranged as one surface, so the page shows what the package draws before a
 * reader opens any reference.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { bg, border, fg } from "@sdxc/u/color";
import { rounded, shadow } from "@sdxc/u/effects";
import { flexWrap, gap, grid, gridTemplate, hstack, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { m, mis, p } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Avatar, Badge, Button, Input, Label, Separator, Switch } from "@sdxc/ui";

/** Renders the overview's component stage. */
export default function UiShowcase(_handle: Handle) {
	return () => (
		<div
			inert
			mix={[
				vstack({ gap: 5, align: "stretch" }),
				p(5),
				rounded("xl"),
				border({ color: "neutral.border", width: 1, style: "solid" }),
				bg(),
				shadow("sm"),
			]}
		>
			<div mix={[hstack({ gap: 2, align: "center" }), flexWrap()]}>
				<Badge color="brand">Interface</Badge>
				<Badge color="success" variant="secondary">
					Accessible
				</Badge>
				<Badge color="neutral" variant="outline">
					Server HTML
				</Badge>
				<span mix={[mis("auto")]}>
					<Switch aria-label="Notifications" defaultChecked />
				</span>
			</div>

			<Separator />

			<div mix={[vstack({ gap: 2, align: "stretch" })]}>
				<Label htmlFor="ui-showcase-project">Project name</Label>
				<div
					mix={[
						grid(),
						gap(2),
						gridTemplate({ columns: "1fr" }),
						media("(min-width: 24rem)", gridTemplate({ columns: "1fr auto" })),
					]}
				>
					<Input id="ui-showcase-project" name="project" defaultValue="Acme Dashboard" />
					<Button type="button" color="brand">
						Save
					</Button>
				</div>
			</div>

			<div mix={[hstack({ gap: 3, align: "center" }), flexWrap()]}>
				<Avatar.Group>
					<Avatar size="sm">
						<Avatar.Fallback>SX</Avatar.Fallback>
					</Avatar>
					<Avatar size="sm">
						<Avatar.Fallback>AL</Avatar.Fallback>
					</Avatar>
					<Avatar size="sm">
						<Avatar.Fallback>JM</Avatar.Fallback>
					</Avatar>
					<Avatar.Group.Count>+5</Avatar.Group.Count>
				</Avatar.Group>
				<p mix={[m(0), text("sm"), fg("neutral")]}>8 teammates online</p>
			</div>
		</div>
	);
}
