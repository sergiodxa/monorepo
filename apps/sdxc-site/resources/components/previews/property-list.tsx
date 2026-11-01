/**
 * Live preview for `PropertyList`: a monitor's properties with a status badge, a link,
 * an owner editable in place from an anchored popover of described options, and an empty
 * value named in words.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border, fg } from "@sdxc/u/color";
import { hstack, vstack } from "@sdxc/u/layout";
import { is, m, maxIs, p } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Avatar, Badge, Button, Link } from "@sdxc/ui";
import { PropertyList } from "@sdxc/ui/property-list";

/** The source the page shows, matching the markup below. */
const CODE = `<PropertyList>
	<PropertyList.Item label="Status"><Badge color="success">Up</Badge></PropertyList.Item>
	<PropertyList.Item label="URL"><Link href="https://api.example.com/health">api.example.com/health</Link></PropertyList.Item>
	<PropertyList.Item label="Interval">30 seconds</PropertyList.Item>
	<PropertyList.Item
		label="Owner"
		edit={{ id: "edit-owner", label: "Edit owner", content: <OwnerForm /> }}
	>
		<Avatar size="sm">…</Avatar> Ana Souza
	</PropertyList.Item>
	<PropertyList.Item label="Escalation" empty="No policy" />
</PropertyList>`;

/** The people the owner can be, each with what owning the monitor means for them. */
const OWNERS = [
	{ value: "ana", name: "Ana Souza", note: "On call this week · gets every alert" },
	{ value: "bruno", name: "Bruno Lima", note: "Platform team · alerts in business hours" },
	{ value: "none", name: "No owner", note: "Alerts go to the team channel only" },
];

/** The owner form the edit popover holds: described radio options and a save. */
function OwnerForm() {
	return () => (
		<form method="post" action="#owner" mix={[vstack({ gap: 3 })]}>
			<fieldset mix={[vstack({ gap: 2 }), m(0), p(0), is("full"), border({ width: 0 })]}>
				<legend mix={[text("xs"), weight("semibold"), fg("neutral.muted")]}>Owner</legend>
				{OWNERS.map((owner) => (
					<label key={owner.value} mix={[hstack({ gap: 2, align: "start" }), weight("medium")]}>
						<input type="radio" name="owner" value={owner.value} checked={owner.value === "ana"} />
						<span mix={[vstack({ gap: 0 })]}>
							{owner.name}
							<span mix={[text("xs"), weight("normal"), fg("neutral.muted")]}>{owner.note}</span>
						</span>
					</label>
				))}
			</fieldset>
			<Button type="submit" size="sm">
				Save
			</Button>
		</form>
	);
}

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full"), maxIs("28rem")]}>
			<PropertyList>
				<PropertyList.Item label="Status">
					<Badge color="success">Up</Badge>
				</PropertyList.Item>
				<PropertyList.Item label="URL">
					<Link href="#api">api.example.com/health</Link>
				</PropertyList.Item>
				<PropertyList.Item label="Interval">30 seconds</PropertyList.Item>
				<PropertyList.Item
					label="Owner"
					edit={{ id: "preview-edit-owner", label: "Edit owner", content: <OwnerForm /> }}
				>
					<Avatar size="sm">
						<Avatar.Fallback>AS</Avatar.Fallback>
					</Avatar>
					Ana Souza
				</PropertyList.Item>
				<PropertyList.Item label="Escalation" empty="No policy" />
			</PropertyList>
		</div>
	),
};
