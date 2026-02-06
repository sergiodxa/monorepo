import type { ComponentProps, PointerEvent as ReactPointerEvent, ReactElement } from "react";

import { cn } from "@pkg/cn";
import {
	Children,
	cloneElement,
	createContext,
	isValidElement,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

type Orientation = "horizontal" | "vertical";

type ResizeState = {
	handleIndex: number;
	startPosition: number;
	startSizes: number[];
	containerSize: number;
};

type ResizableContextValue = {
	orientation: Orientation;
	sizes: number[];
	minSizes: number[];
	maxSizes: number[];
	panelIds: Array<string | undefined>;
	keyboardStep: number;
	isDisabled: boolean;
	activeHandleIndex: number | null;
	startResize: (handleIndex: number, event: ReactPointerEvent<HTMLDivElement>) => void;
	resizeByStep: (handleIndex: number, direction: -1 | 1) => void;
};

const ResizableContext = createContext<ResizableContextValue | null>(null);

const DEFAULT_MIN_SIZE = 10;
const DEFAULT_KEYBOARD_STEP = 2;

function isPanelElement(
	child: unknown,
): child is ReactElement<Resizable.PanelProps & { panelIndex?: number }> {
	return isValidElement<Resizable.PanelProps>(child) && child.type === Resizable.Panel;
}

function isHandleElement(
	child: unknown,
): child is ReactElement<Resizable.HandleProps & { handleIndex?: number }> {
	return isValidElement<Resizable.HandleProps>(child) && child.type === Resizable.Handle;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

function normalizeSizes(sizes: number[]) {
	let total = sizes.reduce((sum, size) => sum + size, 0);
	if (total <= 0) return sizes.map(() => 100 / sizes.length);
	return sizes.map((size) => (size / total) * 100);
}

function applyDelta(
	sizes: number[],
	handleIndex: number,
	delta: number,
	minSizes: number[],
	maxSizes: number[],
) {
	let prevSize = sizes[handleIndex];
	let nextSize = sizes[handleIndex + 1];
	if (prevSize == null || nextSize == null) return sizes;

	let prevMin = minSizes[handleIndex] ?? DEFAULT_MIN_SIZE;
	let prevMax = maxSizes[handleIndex] ?? 100;
	let nextMin = minSizes[handleIndex + 1] ?? DEFAULT_MIN_SIZE;
	let nextMax = maxSizes[handleIndex + 1] ?? 100;

	let deltaMin = Math.max(prevMin - prevSize, nextSize - nextMax);
	let deltaMax = Math.min(prevMax - prevSize, nextSize - nextMin);
	let nextDelta = clamp(delta, deltaMin, deltaMax);

	let nextSizes = sizes.slice();
	nextSizes[handleIndex] = prevSize + nextDelta;
	nextSizes[handleIndex + 1] = nextSize - nextDelta;
	return nextSizes;
}

export namespace Resizable {
	export interface Props extends Omit<ComponentProps<"div">, "className"> {
		className?: cn.ClassName;
		orientation?: Orientation;
		defaultSizes?: number[];
		sizes?: number[];
		onSizesChange?: (sizes: number[]) => void;
		keyboardStep?: number;
		isDisabled?: boolean;
	}

	export interface PanelProps extends Omit<ComponentProps<"div">, "className"> {
		className?: cn.ClassName;
		defaultSize?: number;
		minSize?: number;
		maxSize?: number;
	}

	export interface HandleProps extends Omit<ComponentProps<"div">, "className"> {
		className?: cn.ClassName;
		isDisabled?: boolean;
	}
}

type PanelMetadata = {
	defaultSize?: number;
	minSize?: number;
	maxSize?: number;
	id?: string;
};

export function Resizable({
	className,
	orientation = "horizontal",
	defaultSizes,
	sizes: controlledSizes,
	onSizesChange,
	keyboardStep = DEFAULT_KEYBOARD_STEP,
	isDisabled = false,
	children,
	style,
	...props
}: Resizable.Props) {
	let childArray = Children.toArray(children);
	let panelMetadata = useMemo(() => {
		let metadata: PanelMetadata[] = [];
		childArray.forEach((child) => {
			if (!isPanelElement(child)) return;
			metadata.push({
				defaultSize: child.props.defaultSize,
				minSize: child.props.minSize,
				maxSize: child.props.maxSize,
				id: child.props.id,
			});
		});
		return metadata;
	}, [childArray]);

	let panelCount = panelMetadata.length;
	let panelIds = panelMetadata.map((panel) => panel.id);
	let minSizes = panelMetadata.map((panel) => panel.minSize ?? DEFAULT_MIN_SIZE);
	let maxSizes = panelMetadata.map((panel) => panel.maxSize ?? 100);

	let computedDefaultSizes = useMemo(() => {
		if (defaultSizes && defaultSizes.length === panelCount) {
			return normalizeSizes(defaultSizes);
		}

		let specifiedTotal = panelMetadata.reduce(
			(total, panel) => total + (panel.defaultSize ?? 0),
			0,
		);
		let unspecifiedCount = panelMetadata.filter((panel) => panel.defaultSize == null).length;
		let remaining = Math.max(0, 100 - specifiedTotal);
		let fallbackSize = unspecifiedCount > 0 ? remaining / unspecifiedCount : 0;
		let sizes = panelMetadata.map((panel) => panel.defaultSize ?? fallbackSize);
		return normalizeSizes(sizes);
	}, [defaultSizes, panelCount, panelMetadata]);

	let [uncontrolledSizes, setUncontrolledSizes] = useState(() => computedDefaultSizes);

	useEffect(() => {
		if (controlledSizes) return;
		setUncontrolledSizes(computedDefaultSizes);
	}, [controlledSizes, computedDefaultSizes]);

	let sizes = controlledSizes ?? uncontrolledSizes;
	let sizesRef = useRef(sizes);
	useEffect(() => {
		sizesRef.current = sizes;
	}, [sizes]);

	let setSizes = useCallback(
		(nextSizes: number[]) => {
			if (!controlledSizes) {
				setUncontrolledSizes(nextSizes);
			}
			onSizesChange?.(nextSizes);
		},
		[controlledSizes, onSizesChange],
	);

	let containerRef = useRef<HTMLDivElement | null>(null);
	let resizeState = useRef<ResizeState | null>(null);
	let [activeHandleIndex, setActiveHandleIndex] = useState<number | null>(null);

	let startResize = useCallback(
		(handleIndex: number, event: ReactPointerEvent<HTMLDivElement>) => {
			if (isDisabled) return;
			let container = containerRef.current;
			if (!container) return;

			let rect = container.getBoundingClientRect();
			let containerSize = orientation === "horizontal" ? rect.width : rect.height;
			if (containerSize === 0) return;

			event.preventDefault();
			event.currentTarget.setPointerCapture(event.pointerId);
			let startPosition = orientation === "horizontal" ? event.clientX : event.clientY;
			resizeState.current = {
				handleIndex,
				startPosition,
				startSizes: sizesRef.current,
				containerSize,
			};
			setActiveHandleIndex(handleIndex);
		},
		[isDisabled, orientation],
	);

	let resizeByStep = useCallback(
		(handleIndex: number, direction: -1 | 1) => {
			if (isDisabled) return;
			let delta = keyboardStep * direction;
			let nextSizes = applyDelta(sizesRef.current, handleIndex, delta, minSizes, maxSizes);
			setSizes(nextSizes);
		},
		[isDisabled, keyboardStep, maxSizes, minSizes, setSizes],
	);

	useEffect(() => {
		if (activeHandleIndex == null) return;

		let onPointerMove = (event: globalThis.PointerEvent) => {
			let state = resizeState.current;
			if (!state) return;
			let deltaPx =
				orientation === "horizontal"
					? event.clientX - state.startPosition
					: event.clientY - state.startPosition;
			let deltaPercent = (deltaPx / state.containerSize) * 100;
			let nextSizes = applyDelta(
				state.startSizes,
				state.handleIndex,
				deltaPercent,
				minSizes,
				maxSizes,
			);
			setSizes(nextSizes);
		};

		let onPointerUp = () => {
			resizeState.current = null;
			setActiveHandleIndex(null);
		};

		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp, { once: true });

		return () => {
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
		};
	}, [activeHandleIndex, maxSizes, minSizes, orientation, setSizes]);

	let template = useMemo(() => {
		let parts: string[] = [];
		let panelIndex = 0;
		childArray.forEach((child) => {
			if (!isValidElement(child)) return;
			if (child.type === Resizable.Panel) {
				let size = sizes[panelIndex] ?? 0;
				parts.push(`minmax(0, ${size}fr)`);
				panelIndex += 1;
				return;
			}
			if (child.type === Resizable.Handle) {
				parts.push("var(--resizable-handle-size, 0.75rem)");
			}
		});
		return parts.join(" ");
	}, [childArray, sizes]);

	let clonedChildren = useMemo(() => {
		let panelIndex = 0;
		let handleIndex = 0;
		return childArray.map((child) => {
			if (isPanelElement(child)) {
				let index = panelIndex;
				panelIndex += 1;
				return cloneElement(child, { panelIndex: index });
			}
			if (isHandleElement(child)) {
				let index = handleIndex;
				handleIndex += 1;
				return cloneElement(child, { handleIndex: index });
			}
			return child;
		});
	}, [childArray]);

	let combinedStyle = {
		...style,
		gridAutoFlow: orientation === "horizontal" ? "column" : "row",
		...(orientation === "horizontal"
			? { gridTemplateColumns: template }
			: { gridTemplateRows: template }),
	};

	let contextValue = useMemo<ResizableContextValue>(
		() => ({
			orientation,
			sizes,
			minSizes,
			maxSizes,
			panelIds,
			keyboardStep,
			isDisabled,
			activeHandleIndex,
			startResize,
			resizeByStep,
		}),
		[
			activeHandleIndex,
			isDisabled,
			keyboardStep,
			maxSizes,
			minSizes,
			orientation,
			panelIds,
			resizeByStep,
			sizes,
			startResize,
		],
	);

	return (
		<ResizableContext.Provider value={contextValue}>
			<div
				{...props}
				ref={containerRef}
				className={cn("ui-resizable", className)}
				data-orientation={orientation}
				data-disabled={isDisabled || undefined}
				style={combinedStyle}
			>
				{clonedChildren}
			</div>
		</ResizableContext.Provider>
	);
}

Resizable.Panel = function ResizablePanel({
	className,
	panelIndex,
	minSize,
	maxSize,
	defaultSize,
	style,
	...props
}: Resizable.PanelProps & { panelIndex?: number }) {
	let context = useContext(ResizableContext);
	let orientation = context?.orientation ?? "horizontal";
	let inlineStyle = style;

	if (orientation === "horizontal") {
		inlineStyle = {
			...style,
			minWidth: minSize != null ? `${minSize}%` : undefined,
			maxWidth: maxSize != null ? `${maxSize}%` : undefined,
		};
	} else {
		inlineStyle = {
			...style,
			minHeight: minSize != null ? `${minSize}%` : undefined,
			maxHeight: maxSize != null ? `${maxSize}%` : undefined,
		};
	}

	return (
		<div
			{...props}
			className={cn("ui-resizable-panel", className)}
			data-orientation={orientation}
			data-panel-index={panelIndex}
			data-default-size={defaultSize}
			data-min-size={minSize}
			data-max-size={maxSize}
			style={inlineStyle}
		/>
	);
};

Resizable.Handle = function ResizableHandle({
	className,
	isDisabled,
	handleIndex,
	role,
	style,
	onPointerDown,
	onKeyDown,
	onFocus,
	onBlur,
	...props
}: Resizable.HandleProps & { handleIndex?: number }) {
	let context = useContext(ResizableContext);
	let [isFocusVisible, setIsFocusVisible] = useState(false);
	if (!context) {
		return (
			<div
				{...props}
				className={cn("ui-resizable-handle", className)}
				role={role ?? "separator"}
				style={style}
			/>
		);
	}

	let {
		orientation,
		sizes,
		minSizes,
		maxSizes,
		panelIds,
		isDisabled: isRootDisabled,
		activeHandleIndex,
		startResize,
		resizeByStep,
	} = context;

	let resolvedHandleIndex = handleIndex ?? 0;
	let disabled = isRootDisabled || isDisabled;
	let previousPanelId = panelIds[resolvedHandleIndex];
	let nextPanelId = panelIds[resolvedHandleIndex + 1];
	let controls = [previousPanelId, nextPanelId].filter(Boolean).join(" ") || undefined;
	let valueNow = Math.round(sizes[resolvedHandleIndex] ?? 0);
	let valueMin = minSizes[resolvedHandleIndex] ?? DEFAULT_MIN_SIZE;
	let valueMax = maxSizes[resolvedHandleIndex] ?? 100;

	return (
		<div
			{...props}
			role={role ?? "separator"}
			aria-orientation={orientation}
			aria-controls={controls}
			aria-valuenow={valueNow}
			aria-valuemin={valueMin}
			aria-valuemax={valueMax}
			aria-disabled={disabled || undefined}
			tabIndex={disabled ? -1 : 0}
			className={cn("ui-resizable-handle", className)}
			data-orientation={orientation}
			data-resizing={activeHandleIndex === resolvedHandleIndex || undefined}
			data-disabled={disabled || undefined}
			data-focus-visible={isFocusVisible || undefined}
			style={style}
			onPointerDown={(event) => {
				onPointerDown?.(event);
				if (event.defaultPrevented || disabled) return;
				startResize(resolvedHandleIndex, event);
			}}
			onKeyDown={(event) => {
				onKeyDown?.(event);
				if (event.defaultPrevented || disabled) return;
				if (orientation === "horizontal") {
					if (event.key === "ArrowLeft") {
						event.preventDefault();
						resizeByStep(resolvedHandleIndex, -1);
					}
					if (event.key === "ArrowRight") {
						event.preventDefault();
						resizeByStep(resolvedHandleIndex, 1);
					}
				} else {
					if (event.key === "ArrowUp") {
						event.preventDefault();
						resizeByStep(resolvedHandleIndex, -1);
					}
					if (event.key === "ArrowDown") {
						event.preventDefault();
						resizeByStep(resolvedHandleIndex, 1);
					}
				}
			}}
			onFocus={(event) => {
				onFocus?.(event);
				setIsFocusVisible(event.currentTarget.matches(":focus-visible"));
			}}
			onBlur={(event) => {
				onBlur?.(event);
				setIsFocusVisible(false);
			}}
		/>
	);
};
