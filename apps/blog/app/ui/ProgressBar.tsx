import type { ProgressBarProps as AriaProgressBarProps } from "react-aria-components";

import { ProgressBar as AriaProgressBar } from "react-aria-components";

import { Label } from "./Field";
import { composeTailwindRenderProps } from "./utils";

export interface ProgressBarProps extends AriaProgressBarProps {
	label?: string;
}

export function ProgressBar({ label, ...props }: ProgressBarProps) {
	return (
		<AriaProgressBar
			{...props}
			className={composeTailwindRenderProps(props.className, "flex flex-col gap-1")}
		>
			{({ percentage, valueText, isIndeterminate }) => (
				<>
					<div className="flex justify-between gap-2">
						<Label>{label}</Label>
						<span className="text-gray-600 dark:text-zinc-400 text-sm">{valueText}</span>
					</div>
					<div className="bg-gray-300 dark:bg-zinc-700 relative h-2 w-64 overflow-hidden rounded-full outline-1 -outline-offset-1 outline-transparent">
						<div
							className={`bg-blue-600 dark:bg-blue-500 absolute top-0 h-full rounded-full forced-colors:bg-[Highlight] ${
								isIndeterminate
									? "left-full duration-1000 ease-out animate-in [--tw-enter-translate-x:calc(-16rem-100%)] repeat-infinite slide-out-to-right-full"
									: "left-0"
							}`}
							style={{ width: `${isIndeterminate ? 40 : percentage}%` }}
						/>
					</div>
				</>
			)}
		</AriaProgressBar>
	);
}
