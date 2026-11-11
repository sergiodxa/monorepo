/**
 * Covers {@link PhoneFan} markup: the accessible stage name, three phone slots, and the
 * motion loop that can pause the bob.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { PhoneFan } from "./phone-fan.js";
import { PhoneFrame } from "./phone-frame.js";

describe("PhoneFan", () => {
	test("names the stage and lays three phones inside a motion loop", async () => {
		let html = await renderToString(
			<PhoneFan
				label="Three product screens"
				pauseLabel="Pause the animation"
				start={
					<PhoneFrame>
						<img src="/start.webp" alt="Start" />
					</PhoneFrame>
				}
				front={
					<PhoneFrame>
						<img src="/front.webp" alt="Front" />
					</PhoneFrame>
				}
				end={
					<PhoneFrame>
						<img src="/end.webp" alt="End" />
					</PhoneFrame>
				}
			/>,
		);

		expect(html).toContain('data-slot="phone-fan"');
		expect(html).toContain('aria-label="Three product screens"');
		expect(html).toContain('data-slot="motion-loop"');
		expect(html).toContain("Pause the animation");
		expect(html).toContain('data-slot="phone-fan-front"');
		expect(html).toContain('data-side="start"');
		expect(html).toContain('data-side="end"');
		expect(html).toContain('src="/start.webp"');
		expect(html).toContain('src="/front.webp"');
		expect(html).toContain('src="/end.webp"');
	});
});
