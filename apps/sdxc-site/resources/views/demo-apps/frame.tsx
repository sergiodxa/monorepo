/**
 * One secondary part of a demo app screen, streamed in after the screen's shell: the page
 * draws the placeholder at once and the part replaces it when its own route answers, so the
 * list a screen exists for never waits on a chart, a feed or a side panel.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Renderable } from "remix/component";

import { Frame } from "remix/component";

import { demoAppFrameHref } from "~/resources/views/demo-apps";

namespace DemoAppFrame {
	export interface Props {
		/** The demo's folder name. */
		app: string;
		/** The part's path under the app, with the screen state it reads as its query. */
		part: string;
		/**
		 * What the page shows until the part arrives: `Skeleton` shapes at the part's final
		 * size, so nothing below it moves when it lands.
		 */
		fallback: Renderable;
		/** Registers the frame for a form or link that reloads just this part. */
		name?: string;
	}
}

/** Renders the part as a non-blocking frame over its placeholder. */
export default function DemoAppFrame(handle: Handle<DemoAppFrame.Props>) {
	return () => {
		let { app, fallback, name, part } = handle.props;
		return <Frame src={demoAppFrameHref(app)(part)} fallback={fallback} name={name} />;
	};
}
