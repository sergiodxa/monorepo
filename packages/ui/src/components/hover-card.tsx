import type {
	ComponentProps,
	FocusEvent,
	MutableRefObject,
	PointerEvent,
	ReactElement,
	ReactNode,
	Ref,
} from "react";

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

import { OverlayArrow } from "./overlay-arrow";
import { Popover } from "./popover";

interface HoverCardContextValue {
	triggerRef: React.RefObject<HTMLElement | null>;
	onCardHoverChange: (isHovered: boolean) => void;
	onCardFocusChange: (isFocused: boolean) => void;
}

interface HoverCardTriggerState {
	isOpen: boolean;
	open: () => void;
	close: () => void;
}

const HoverCardTriggerStateContext = createContext<HoverCardTriggerState | null>(null);
const HoverCardContext = createContext<HoverCardContextValue | null>(null);

export namespace HoverCardTrigger {
	export interface Props {
		children: ReactNode;
		isOpen?: boolean;
		defaultOpen?: boolean;
		onOpenChange?: (isOpen: boolean) => void;
		openDelay?: number;
		closeDelay?: number;
	}
}

function mergeRefs<T>(...refs: Array<Ref<T> | undefined>) {
	return (value: T | null) => {
		for (let ref of refs) {
			if (typeof ref === "function") {
				ref(value);
				continue;
			}
			if (ref && typeof ref === "object") {
				(ref as MutableRefObject<T | null>).current = value;
			}
		}
	};
}

export function HoverCardTrigger({
	children,
	openDelay = 400,
	closeDelay = 200,
	isOpen: controlledOpen,
	defaultOpen = false,
	onOpenChange,
}: HoverCardTrigger.Props) {
	let [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
	let isControlled = controlledOpen !== undefined;
	let isOpen = isControlled ? (controlledOpen as boolean) : uncontrolledOpen;

	let open = useCallback(() => {
		if (!isControlled) setUncontrolledOpen(true);
		onOpenChange?.(true);
	}, [isControlled, onOpenChange]);

	let close = useCallback(() => {
		if (!isControlled) setUncontrolledOpen(false);
		onOpenChange?.(false);
	}, [isControlled, onOpenChange]);

	let state = useMemo<HoverCardTriggerState>(
		() => ({ isOpen, open, close }),
		[close, isOpen, open],
	);

	let triggerRef = useRef<HTMLElement | null>(null);
	let interactionState = useRef({
		triggerHover: false,
		cardHover: false,
		triggerFocus: false,
		cardFocus: false,
	});
	let openTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	let closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	let clearTimeouts = useCallback(() => {
		if (openTimeoutRef.current) clearTimeout(openTimeoutRef.current);
		if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
		openTimeoutRef.current = null;
		closeTimeoutRef.current = null;
	}, []);

	// Cleanup timeouts on unmount
	useEffect(() => clearTimeouts, [clearTimeouts]);

	let evaluateState = useCallback(() => {
		let { triggerHover, cardHover, triggerFocus, cardFocus } = interactionState.current;
		let shouldBeOpen = triggerHover || cardHover || triggerFocus || cardFocus;

		clearTimeouts();

		if (shouldBeOpen && !state.isOpen) {
			// Focus opens immediately, hover has delay
			let delay = triggerFocus || cardFocus ? 0 : openDelay;
			openTimeoutRef.current = setTimeout(() => state.open(), delay);
		} else if (!shouldBeOpen && state.isOpen) {
			closeTimeoutRef.current = setTimeout(() => state.close(), closeDelay);
		}
	}, [clearTimeouts, closeDelay, openDelay, state]);

	let setInteraction = useCallback(
		(key: keyof typeof interactionState.current, value: boolean) => {
			interactionState.current[key] = value;
			evaluateState();
		},
		[evaluateState],
	);

	let contextValue = useMemo<HoverCardContextValue>(
		() => ({
			triggerRef,
			onCardHoverChange: (isHovered) => setInteraction("cardHover", isHovered),
			onCardFocusChange: (isFocused) => setInteraction("cardFocus", isFocused),
		}),
		[setInteraction],
	);

	let childElements = Children.toArray(children);
	let triggerChild = childElements[0];
	let cardChildren = childElements.slice(1);
	if (!isValidElement(triggerChild)) return null;

	let child = triggerChild as ReactElement<{ [key: string]: unknown }> & { ref?: Ref<HTMLElement> };

	let handlePointerEnter = () => setInteraction("triggerHover", true);
	let handlePointerLeave = () => setInteraction("triggerHover", false);
	let handleFocus = () => setInteraction("triggerFocus", true);
	let handleBlur = (event: FocusEvent<HTMLElement>) => {
		if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
		setInteraction("triggerFocus", false);
	};

	return (
		<HoverCardTriggerStateContext.Provider value={state}>
			<HoverCardContext.Provider value={contextValue}>
				{cloneElement(child, {
					...child.props,
					ref: mergeRefs(child.ref, triggerRef),
					"aria-haspopup": "dialog",
					"aria-expanded": state.isOpen || undefined,
					onPointerEnter: (e: PointerEvent<HTMLElement>) => {
						(child.props.onPointerEnter as ((e: PointerEvent<HTMLElement>) => void) | undefined)?.(
							e,
						);
						handlePointerEnter();
					},
					onPointerLeave: (e: PointerEvent<HTMLElement>) => {
						(child.props.onPointerLeave as ((e: PointerEvent<HTMLElement>) => void) | undefined)?.(
							e,
						);
						handlePointerLeave();
					},
					onFocus: (e: FocusEvent<HTMLElement>) => {
						(child.props.onFocus as ((e: FocusEvent<HTMLElement>) => void) | undefined)?.(e);
						handleFocus();
					},
					onBlur: (e: FocusEvent<HTMLElement>) => {
						(child.props.onBlur as ((e: FocusEvent<HTMLElement>) => void) | undefined)?.(e);
						handleBlur(e);
					},
				})}
				{cardChildren}
			</HoverCardContext.Provider>
		</HoverCardTriggerStateContext.Provider>
	);
}

export namespace HoverCard {
	export interface Props extends Omit<ComponentProps<typeof Popover>, "className"> {
		className?: cn.ClassName;
		showArrow?: boolean;
		onPointerEnter?: (event: PointerEvent<HTMLElement>) => void;
		onPointerLeave?: (event: PointerEvent<HTMLElement>) => void;
	}
}

export function HoverCard({
	className,
	children,
	showArrow = true,
	offset = 8,
	isNonModal = true,
	onPointerEnter,
	onPointerLeave,
	...props
}: HoverCard.Props) {
	let context = useContext(HoverCardContext);
	let triggerState = useContext(HoverCardTriggerStateContext);

	let handlePointerEnter = () => context?.onCardHoverChange(true);
	let handlePointerLeave = () => context?.onCardHoverChange(false);
	let handleFocus = () => context?.onCardFocusChange(true);
	let handleBlur = (event: FocusEvent<HTMLElement>) => {
		if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
		context?.onCardFocusChange(false);
	};

	let onOpenChange = useCallback(
		(isOpen: boolean) => {
			props.onOpenChange?.(isOpen);
			if (triggerState) {
				if (isOpen) triggerState.open();
				else triggerState.close();
			}
		},
		[props, triggerState],
	);

	return (
		<Popover
			{...props}
			triggerRef={context?.triggerRef ?? props.triggerRef}
			isOpen={triggerState ? triggerState.isOpen : props.isOpen}
			onOpenChange={triggerState ? onOpenChange : props.onOpenChange}
			offset={offset}
			isNonModal={isNonModal}
			trigger="HoverCard"
			className={cn("ui-hover-card", className)}
		>
			{(renderProps) => (
				<div
					onPointerEnter={(event) => {
						onPointerEnter?.(event);
						handlePointerEnter();
					}}
					onPointerLeave={(event) => {
						onPointerLeave?.(event);
						handlePointerLeave();
					}}
					onFocusCapture={handleFocus}
					onBlurCapture={handleBlur}
				>
					{showArrow && (
						<OverlayArrow className="ui-hover-card-arrow">
							<svg width={12} height={12} viewBox="0 0 12 12">
								<path d="M0 0 L6 6 L12 0" />
							</svg>
						</OverlayArrow>
					)}
					{typeof children === "function" ? children(renderProps) : children}
				</div>
			)}
		</Popover>
	);
}
