/**
 * Live preview island for `Message`. One turn on its own says nothing about the layout,
 * so the preview is a support thread: an inbound turn with its actions, an outbound turn
 * whose bubble aligns to the end, and a run of consecutive replies inside
 * `Message.Group`. The copy action carries `copyToClipboard()`, which needs script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { CopyIcon, ReplyIcon } from "@sdxc/icons";
import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { Avatar, Bubble, Button, Message } from "@sdxc/ui";
import { COPY_COMMAND, copyToClipboard } from "@sdxc/ui/mixins";
import { clientEntry } from "remix/component";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const CODE = `<div mix={[vstack({ gap: 6, align: "stretch" })]}>
	<Message>
		<Message.Avatar>
			<Avatar>
				<Avatar.Fallback>AR</Avatar.Fallback>
			</Avatar>
		</Message.Avatar>
		<Message.Header>
			<strong>Ana Ruiz</strong>
			<time dateTime="2026-09-21T14:02">14:02</time>
		</Message.Header>
		<Message.Content>
						<Bubble variant="muted">
				<Bubble.Content id="turn-1-text">
					The deploy finished but the worker is still serving the old bundle. Is there a cache
					I should be busting?
				</Bubble.Content>
			</Bubble>
		</Message.Content>
		<Message.Footer>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				aria-label="Copy message"
				commandfor="turn-1-text"
				command={COPY_COMMAND}
				mix={[copyToClipboard()]}
			>
				<CopyIcon />
			</Button>
			<Button type="button" variant="ghost" size="sm" aria-label="Reply to Ana Ruiz">
				<ReplyIcon />
			</Button>
		</Message.Footer>
	</Message>

	<Message>
		<Message.Avatar>
			<Avatar>
				<Avatar.Fallback>SX</Avatar.Fallback>
			</Avatar>
		</Message.Avatar>
		<Message.Header>
			<strong>Sergio</strong>
			<time dateTime="2026-09-21T14:05">14:05</time>
		</Message.Header>
		<Message.Content>
			<Bubble align="end">
				<Bubble.Content>
					The bundle is fingerprinted, so that is the CDN holding a stale index.
				</Bubble.Content>
			</Bubble>
		</Message.Content>
	</Message>

	<Message.Group>
		<Message>
			{/* A run's later turns carry the avatar, so the turns above it reserve its column. */}
			<Message.Avatar aria-hidden="true">
				<span mix={[is("2.5rem")]} />
			</Message.Avatar>
			<Message.Header>
				<strong>Ana Ruiz</strong>
				<time dateTime="2026-09-21T14:07">14:07</time>
			</Message.Header>
			<Message.Content>
				<Bubble variant="muted">
					<Bubble.Content>Purging it now.</Bubble.Content>
				</Bubble>
			</Message.Content>
		</Message>
		<Message>
			<Message.Avatar>
				<Avatar>
					<Avatar.Fallback>AR</Avatar.Fallback>
				</Avatar>
			</Message.Avatar>
			<Message.Content>
				<Bubble variant="muted">
					<Bubble.Content>That did it — thank you.</Bubble.Content>
				</Bubble>
			</Message.Content>
		</Message>
	</Message.Group>
</div>`;

/** A support thread, hydrated so the copy action has a clipboard write to perform. */
export const MessagePreview = clientEntry(
	"/resources/components/previews/message.tsx#MessagePreview",
	function MessagePreview() {
		return () => (
			<div mix={[vstack({ gap: 6, align: "stretch" }), is("30rem")]}>
				<Message>
					<Message.Avatar>
						<Avatar>
							<Avatar.Fallback>AR</Avatar.Fallback>
						</Avatar>
					</Message.Avatar>
					<Message.Header>
						<strong>Ana Ruiz</strong>
						<time dateTime="2026-09-21T14:02">14:02</time>
					</Message.Header>
					<Message.Content>
						<Bubble variant="muted">
							<Bubble.Content id="preview-message-turn-1-text">
								The deploy finished but the worker is still serving the old bundle. Is there a cache
								I should be busting?
							</Bubble.Content>
						</Bubble>
					</Message.Content>
					<Message.Footer>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							aria-label="Copy message"
							commandfor="preview-message-turn-1-text"
							command={COPY_COMMAND}
							mix={[copyToClipboard()]}
						>
							<CopyIcon />
						</Button>
						<Button type="button" variant="ghost" size="sm" aria-label="Reply to Ana Ruiz">
							<ReplyIcon />
						</Button>
					</Message.Footer>
				</Message>

				<Message>
					<Message.Avatar>
						<Avatar>
							<Avatar.Fallback>SX</Avatar.Fallback>
						</Avatar>
					</Message.Avatar>
					<Message.Header>
						<strong>Sergio</strong>
						<time dateTime="2026-09-21T14:05">14:05</time>
					</Message.Header>
					<Message.Content>
						<Bubble align="end">
							<Bubble.Content>
								The bundle is fingerprinted, so that is the CDN holding a stale index.
							</Bubble.Content>
						</Bubble>
					</Message.Content>
				</Message>

				<Message.Group>
					<Message>
						{/* A run's later turns carry the avatar, so the turns above it reserve its column. */}
						<Message.Avatar aria-hidden="true">
							<span mix={[is("2.5rem")]} />
						</Message.Avatar>
						<Message.Header>
							<strong>Ana Ruiz</strong>
							<time dateTime="2026-09-21T14:07">14:07</time>
						</Message.Header>
						<Message.Content>
							<Bubble variant="muted">
								<Bubble.Content>Purging it now.</Bubble.Content>
							</Bubble>
						</Message.Content>
					</Message>
					<Message>
						<Message.Avatar>
							<Avatar>
								<Avatar.Fallback>AR</Avatar.Fallback>
							</Avatar>
						</Message.Avatar>
						<Message.Content>
							<Bubble variant="muted">
								<Bubble.Content>That did it — thank you.</Bubble.Content>
							</Bubble>
						</Message.Content>
					</Message>
				</Message.Group>
			</div>
		);
	},
);

export default { code: CODE, render: () => <MessagePreview /> };
