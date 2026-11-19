/**
 * Live preview island for `MessageGroup`. A team chat reads as runs of one person's lines, so
 * the preview is one run: the first line with its face, name and actions, then a later line
 * that names the reader, was edited and opened a thread. Hover a line to see its time.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { EllipsisIcon, MessageSquareTextIcon } from "@sdxc/icons";
import { is } from "@sdxc/u/size";
import { Avatar, Button } from "@sdxc/ui";
import { MessageGroup } from "@sdxc/ui/chat/message-group";
import { clientEntry } from "remix/component";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const CODE = `<MessageGroup>
	<MessageGroup.Item id="m-1">
		<MessageGroup.Avatar>
			<Avatar>
				<Avatar.Fallback>MO</Avatar.Fallback>
			</Avatar>
		</MessageGroup.Avatar>
		<MessageGroup.Header>
			<span>Mira Okafor</span>
			<time dateTime="2026-11-18T10:42">10:42</time>
		</MessageGroup.Header>
		<MessageGroup.Content>
			<p>Store screenshots are final, light and dark.</p>
		</MessageGroup.Content>
		<MessageGroup.Actions aria-label="Message actions">
			<Button variant="ghost" color="neutral" size="sm" aria-label="Reply in thread">
				<MessageSquareTextIcon size={16} />
			</Button>
			<Button variant="ghost" color="neutral" size="sm" aria-label="More actions">
				<EllipsisIcon size={16} />
			</Button>
		</MessageGroup.Actions>
	</MessageGroup.Item>
	<MessageGroup.Item id="m-2" mentioned>
		<MessageGroup.Time dateTime="2026-11-18T10:43">10:43</MessageGroup.Time>
		<MessageGroup.Content>
			<p>
				@Sam can you check the dark one? <MessageGroup.Edited>(edited)</MessageGroup.Edited>
			</p>
			<MessageGroup.Thread href="#thread" avatars={<Avatar size="sm"><Avatar.Fallback>T</Avatar.Fallback></Avatar>}>
				<strong>3 replies</strong> Last reply 10:58
			</MessageGroup.Thread>
		</MessageGroup.Content>
	</MessageGroup.Item>
</MessageGroup>`;

/** One run of messages, hydrated so the page loads this example's chunk alone. */
export const MessageGroupPreview = clientEntry(import.meta.url, function MessageGroupPreview() {
	return () => (
		<div mix={[is("32rem")]}>
			<MessageGroup>
				<MessageGroup.Item id="m-1">
					<MessageGroup.Avatar>
						<Avatar>
							<Avatar.Fallback>MO</Avatar.Fallback>
						</Avatar>
					</MessageGroup.Avatar>
					<MessageGroup.Header>
						<span>Mira Okafor</span>
						<time dateTime="2026-11-18T10:42">10:42</time>
					</MessageGroup.Header>
					<MessageGroup.Content>
						<p>Store screenshots are final, light and dark.</p>
					</MessageGroup.Content>
					<MessageGroup.Actions aria-label="Message actions">
						<Button variant="ghost" color="neutral" size="sm" aria-label="Reply in thread">
							<MessageSquareTextIcon size={16} />
						</Button>
						<Button variant="ghost" color="neutral" size="sm" aria-label="More actions">
							<EllipsisIcon size={16} />
						</Button>
					</MessageGroup.Actions>
				</MessageGroup.Item>
				<MessageGroup.Item id="m-2" mentioned>
					<MessageGroup.Time dateTime="2026-11-18T10:43">10:43</MessageGroup.Time>
					<MessageGroup.Content>
						<p>
							@Sam can you check the dark one? <MessageGroup.Edited>(edited)</MessageGroup.Edited>
						</p>
						<MessageGroup.Thread
							href="#thread"
							avatars={
								<Avatar size="sm">
									<Avatar.Fallback>T</Avatar.Fallback>
								</Avatar>
							}
						>
							<strong>3 replies</strong> Last reply 10:58
						</MessageGroup.Thread>
					</MessageGroup.Content>
				</MessageGroup.Item>
			</MessageGroup>
		</div>
	);
});

export default { code: CODE, render: () => <MessageGroupPreview /> };
