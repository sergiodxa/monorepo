import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import { useEffect, useRef } from "react";
import {
	Tabs as AriaTabs,
	TabList as AriaTabList,
	Tab as AriaTab,
	TabPanel as AriaTabPanel,
	TabPanels as AriaTabPanels,
} from "react-aria-components";

export namespace Tabs {
	export interface Props extends Omit<ComponentProps<typeof AriaTabs>, "className"> {
		className?: cn.ClassName;
	}

	export interface ListProps<T extends object> extends Omit<
		ComponentProps<typeof AriaTabList<T>>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export interface TabProps extends Omit<ComponentProps<typeof AriaTab>, "className"> {
		className?: cn.ClassName;
	}

	export interface PanelsProps<T extends object> extends Omit<
		ComponentProps<typeof AriaTabPanels<T>>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export interface PanelProps extends Omit<ComponentProps<typeof AriaTabPanel>, "className"> {
		className?: cn.ClassName;
	}
}

export function Tabs({ className, ...props }: Tabs.Props) {
	return <AriaTabs {...props} className={cn("ui-tabs", className)} />;
}

Tabs.List = function TabsList<T extends object>({ className, ...props }: Tabs.ListProps<T>) {
	let listRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		let list = listRef.current;
		if (!list) return;

		let frame = 0;
		let observedSelected: HTMLElement | null = null;
		let controller = new AbortController();

		let updateIndicator = () => {
			let selected = list.querySelector<HTMLElement>("[data-selected]");
			if (selected !== observedSelected) {
				if (observedSelected) resizeObserver.unobserve(observedSelected);
				if (selected) resizeObserver.observe(selected);
				observedSelected = selected;
			}

			if (!selected) {
				list.style.setProperty("--ui-tab-indicator-opacity", "0");
				return;
			}

			let listRect = list.getBoundingClientRect();
			let selectedRect = selected.getBoundingClientRect();
			let isVertical = Boolean(list.closest('[data-orientation="vertical"]'));

			if (isVertical) {
				let top = selectedRect.top - listRect.top + list.scrollTop;
				list.style.setProperty("--ui-tab-indicator-top", `${top}px`);
				list.style.setProperty("--ui-tab-indicator-height", `${selectedRect.height}px`);
			} else {
				let left = selectedRect.left - listRect.left + list.scrollLeft;
				list.style.setProperty("--ui-tab-indicator-left", `${left}px`);
				list.style.setProperty("--ui-tab-indicator-width", `${selectedRect.width}px`);
			}

			list.style.setProperty("--ui-tab-indicator-opacity", "1");
		};

		let schedule = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(updateIndicator);
		};

		let resizeObserver = new ResizeObserver(schedule);
		let mutationObserver = new MutationObserver(schedule);

		resizeObserver.observe(list);
		mutationObserver.observe(list, {
			subtree: true,
			attributes: true,
			attributeFilter: ["data-selected"],
		});

		schedule();

		// Use AbortController signal for all event listeners
		window.addEventListener("resize", schedule, { signal: controller.signal });

		return () => {
			controller.abort();
			cancelAnimationFrame(frame);
			resizeObserver.disconnect();
			mutationObserver.disconnect();
		};
	}, []);

	return <AriaTabList ref={listRef} {...props} className={cn("ui-tab-list", className)} />;
};

Tabs.Tab = function TabsTab({ className, ...props }: Tabs.TabProps) {
	return <AriaTab {...props} className={cn("ui-tab", className)} />;
};

Tabs.Panels = function TabsPanels<T extends object>({ className, ...props }: Tabs.PanelsProps<T>) {
	return <AriaTabPanels {...props} className={cn("ui-tab-panels", className)} />;
};

Tabs.Panel = function TabsPanel({ className, ...props }: Tabs.PanelProps) {
	return <AriaTabPanel {...props} className={cn("ui-tab-panel", className)} />;
};
