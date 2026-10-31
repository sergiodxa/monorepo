/**
 * Live preview for `Steps`: the three steps of a monitoring quickstart, each title a
 * heading with an anchor a table of contents can link, one step carrying a command.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is } from "@sdxc/u/size";
import { HeadingScope, Steps } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Steps>
	<Steps.Item id="add-a-monitor" title="Add a monitor">
		<p>Paste the URL you want watched and pick how often it is checked.</p>
	</Steps.Item>
	<Steps.Item id="choose-who-gets-alerted" title="Choose who gets alerted">
		<p>Route alerts to a person, a rotation or a Slack channel.</p>
	</Steps.Item>
	<Steps.Item id="send-a-test-alert" title="Send a test alert">
		<pre><code>curl -X POST https://api.example.com/monitors/checkout/test</code></pre>
	</Steps.Item>
</Steps>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full")]}>
			<HeadingScope level={2}>
				<Steps>
					<Steps.Item id="add-a-monitor" title="Add a monitor">
						<p>Paste the URL you want watched and pick how often it is checked.</p>
					</Steps.Item>
					<Steps.Item id="choose-who-gets-alerted" title="Choose who gets alerted">
						<p>Route alerts to a person, a rotation or a Slack channel.</p>
					</Steps.Item>
					<Steps.Item id="send-a-test-alert" title="Send a test alert">
						<pre style={{ margin: "0", overflowX: "auto" }}>
							<code>curl -X POST https://api.example.com/monitors/checkout/test</code>
						</pre>
					</Steps.Item>
				</Steps>
			</HeadingScope>
		</div>
	),
};
