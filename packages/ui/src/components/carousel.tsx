import type { ComponentProps, KeyboardEvent, ReactNode, RefObject } from "react";

import { cn } from "@pkg/cn";
import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { ButtonContext } from "react-aria-components";

import { Button } from "./button";

interface CarouselContextValue {
	viewportId: string;
	viewportRef: RefObject<HTMLDivElement | null>;
	canScrollPrev: boolean;
	canScrollNext: boolean;
	scrollPrev: () => void;
	scrollNext: () => void;
	scrollToStart: () => void;
	scrollToEnd: () => void;
}

const CarouselContext = createContext<CarouselContextValue | null>(null);

function useCarouselContext(componentName: string) {
	let context = useContext(CarouselContext);
	if (!context) throw new Error(`${componentName} must be used within Carousel.`);
	return context;
}

export namespace Carousel {
	export interface Props extends Omit<ComponentProps<"section">, "className"> {
		className?: cn.ClassName;
	}

	export interface ViewportProps extends Omit<ComponentProps<"div">, "className"> {
		className?: cn.ClassName;
	}

	export interface TrackProps extends Omit<ComponentProps<"div">, "className"> {
		className?: cn.ClassName;
	}

	export interface SlideProps extends Omit<ComponentProps<"div">, "className"> {
		className?: cn.ClassName;
	}

	export interface ControlsProps extends Omit<ComponentProps<"div">, "className"> {
		className?: cn.ClassName;
	}

	export interface ControlProps {
		className?: cn.ClassName;
		children?: ReactNode;
	}
}

export function Carousel({ className, id, ...props }: Carousel.Props) {
	let generatedId = useId();
	let viewportId = id ? `${id}-viewport` : `${generatedId}-viewport`;
	let viewportRef = useRef<HTMLDivElement>(null);
	let [canScrollPrev, setCanScrollPrev] = useState(false);
	let [canScrollNext, setCanScrollNext] = useState(false);

	useEffect(() => {
		let viewport = viewportRef.current;
		if (!viewport) return;

		let updateScrollState = () => {
			let maxScroll = viewport.scrollWidth - viewport.clientWidth;
			setCanScrollPrev(viewport.scrollLeft > 0);
			setCanScrollNext(viewport.scrollLeft < maxScroll - 1);
		};

		let resizeObserver = new ResizeObserver(updateScrollState);
		resizeObserver.observe(viewport);
		updateScrollState();

		let controller = new AbortController();
		viewport.addEventListener("scroll", updateScrollState, {
			passive: true,
			signal: controller.signal,
		});

		return () => {
			resizeObserver.disconnect();
			controller.abort();
		};
	}, []);

	let scrollBy = (delta: number) => {
		viewportRef.current?.scrollBy({ left: delta, behavior: "smooth" });
	};

	let scrollPrev = () => scrollBy(-(viewportRef.current?.clientWidth ?? 0));
	let scrollNext = () => scrollBy(viewportRef.current?.clientWidth ?? 0);
	let scrollToStart = () => viewportRef.current?.scrollTo({ left: 0, behavior: "smooth" });
	let scrollToEnd = () => {
		let viewport = viewportRef.current;
		if (!viewport) return;
		viewport.scrollTo({ left: viewport.scrollWidth - viewport.clientWidth, behavior: "smooth" });
	};

	return (
		<CarouselContext.Provider
			value={{
				viewportId,
				viewportRef,
				canScrollPrev,
				canScrollNext,
				scrollPrev,
				scrollNext,
				scrollToStart,
				scrollToEnd,
			}}
		>
			<section
				{...props}
				id={id}
				role="region"
				aria-roledescription="carousel"
				className={cn("ui-carousel", className)}
			>
				{props.children}
			</section>
		</CarouselContext.Provider>
	);
}

Carousel.Viewport = function CarouselViewport({
	className,
	onKeyDown,
	...props
}: Carousel.ViewportProps) {
	let { viewportId, viewportRef, scrollPrev, scrollNext, scrollToStart, scrollToEnd } =
		useCarouselContext("Carousel.Viewport");

	let handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		onKeyDown?.(event);
		if (event.defaultPrevented) return;

		switch (event.key) {
			case "ArrowLeft":
				event.preventDefault();
				scrollPrev();
				break;
			case "ArrowRight":
				event.preventDefault();
				scrollNext();
				break;
			case "Home":
				event.preventDefault();
				scrollToStart();
				break;
			case "End":
				event.preventDefault();
				scrollToEnd();
				break;
			default:
				break;
		}
	};

	return (
		<div
			{...props}
			role="group"
			id={viewportId}
			ref={viewportRef}
			data-slot="viewport"
			tabIndex={props.tabIndex ?? 0}
			className={cn("ui-carousel-viewport", className)}
			onKeyDown={handleKeyDown}
		/>
	);
};

Carousel.Track = function CarouselTrack({ className, ...props }: Carousel.TrackProps) {
	return <div {...props} data-slot="track" className={cn("ui-carousel-track", className)} />;
};

Carousel.Slide = function CarouselSlide({ className, ...props }: Carousel.SlideProps) {
	return (
		<div
			{...props}
			role="group"
			aria-roledescription="slide"
			data-slot="slide"
			className={cn("ui-carousel-slide", className)}
		/>
	);
};

Carousel.Controls = function CarouselControls({ className, ...props }: Carousel.ControlsProps) {
	return <div {...props} data-slot="controls" className={cn("ui-carousel-controls", className)} />;
};

Carousel.Previous = function CarouselPrevious({ className, children }: Carousel.ControlProps) {
	let { viewportId, scrollPrev, canScrollPrev } = useCarouselContext("Carousel.Previous");

	let defaultButton = (
		<Button
			aria-label="Previous slide"
			aria-controls={viewportId}
			variant="ghost"
			color="neutral"
			size="sm"
			className={cn("ui-carousel-control", className)}
		>
			<svg viewBox="0 0 20 20" aria-hidden>
				<path fill="currentColor" d="M12.5 15.5L7 10l5.5-5.5 1.4 1.4L9.8 10l4.1 4.1-1.4 1.4z" />
			</svg>
		</Button>
	);

	return (
		<ButtonContext.Provider
			value={{
				slots: {
					previous: {
						onPress: scrollPrev,
						isDisabled: !canScrollPrev,
						"aria-controls": viewportId,
					},
				},
			}}
		>
			{children ?? defaultButton}
		</ButtonContext.Provider>
	);
};

Carousel.Next = function CarouselNext({ className, children }: Carousel.ControlProps) {
	let { viewportId, scrollNext, canScrollNext } = useCarouselContext("Carousel.Next");

	let defaultButton = (
		<Button
			aria-label="Next slide"
			aria-controls={viewportId}
			variant="ghost"
			color="neutral"
			size="sm"
			className={cn("ui-carousel-control", className)}
		>
			<svg viewBox="0 0 20 20" aria-hidden>
				<path fill="currentColor" d="M7.5 4.5L13 10l-5.5 5.5-1.4-1.4 4.1-4.1-4.1-4.1 1.4-1.4z" />
			</svg>
		</Button>
	);

	return (
		<ButtonContext.Provider
			value={{
				slots: {
					next: {
						onPress: scrollNext,
						isDisabled: !canScrollNext,
						"aria-controls": viewportId,
					},
				},
			}}
		>
			{children ?? defaultButton}
		</ButtonContext.Provider>
	);
};
