/**
 * A `wordBreak` example in Korean, where browsers break between any two syllables until
 * `"keep-all"` holds each word together and wraps only at spaces.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { maxIs } from "@sdxc/u/size";
import { wordBreak } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Korean text wrapped by syllable and by whole word. */
export default {
	title: "Keeping CJK words whole",
	description:
		'Use `wordBreak("keep-all")` so Chinese, Japanese and Korean text wraps between words rather than in the middle of one:',
	render: () => (
		<div mix={[demo.stack()]}>
			<div mix={[maxIs(48), demo.panel()]}>
				<p mix={[demo.caption()]}>wordBreak("keep-all")</p>
				<p lang="ko" mix={[wordBreak("keep-all")]}>
					서울의 가을 하늘은 유난히 높고 맑아서 산책하기에 좋습니다.
				</p>
			</div>
			<div mix={[maxIs(48), demo.panel()]}>
				<p mix={[demo.caption()]}>wordBreak("normal")</p>
				<p lang="ko" mix={[wordBreak("normal")]}>
					서울의 가을 하늘은 유난히 높고 맑아서 산책하기에 좋습니다.
				</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
