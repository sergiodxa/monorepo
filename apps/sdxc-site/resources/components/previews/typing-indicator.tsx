/**
 * Live preview island for `TypingIndicator`. The line has four states, so the preview stacks
 * them: one person, two people, several, and nobody, which keeps its height so a conversation
 * above it never jumps.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { TypingIndicator, typingLabel } from "@sdxc/ui/chat/typing-indicator";
import { clientEntry } from "remix/component";

/** The sentences each case reads. */
const LABELS: TypingIndicator.Labels = {
	one: (name) => `${name} is typing…`,
	two: (first, second) => `${first} and ${second} are typing…`,
	many: (count) => `${count} people are typing…`,
};

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const CODE = `const LABELS: TypingIndicator.Labels = {
	one: (name) => \`\${name} is typing…\`,
	two: (first, second) => \`\${first} and \${second} are typing…\`,
	many: (count) => \`\${count} people are typing…\`,
};

<div mix={[vstack({ gap: 3, align: "stretch" })]}>
	<TypingIndicator>{typingLabel(["Mira"], LABELS)}</TypingIndicator>
	<TypingIndicator>{typingLabel(["Mira", "Theo"], LABELS)}</TypingIndicator>
	<TypingIndicator>{typingLabel(["Mira", "Theo", "Kenji"], LABELS)}</TypingIndicator>
	<TypingIndicator />
</div>`;

/** Every state of the typing line, hydrated so the page loads this example's chunk alone. */
export const TypingIndicatorPreview = clientEntry(
	import.meta.url,
	function TypingIndicatorPreview() {
		return () => (
			<div mix={[is("20rem")]}>
				<div mix={[vstack({ gap: 3, align: "stretch" })]}>
					<TypingIndicator>{typingLabel(["Mira"], LABELS)}</TypingIndicator>
					<TypingIndicator>{typingLabel(["Mira", "Theo"], LABELS)}</TypingIndicator>
					<TypingIndicator>{typingLabel(["Mira", "Theo", "Kenji"], LABELS)}</TypingIndicator>
					<TypingIndicator />
				</div>
			</div>
		);
	},
);

export default { code: CODE, render: () => <TypingIndicatorPreview /> };
