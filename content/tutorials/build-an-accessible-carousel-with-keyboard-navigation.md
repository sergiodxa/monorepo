---
title: How to Build an Accessible Carousel with Keyboard Support
excerpt: Build a carousel component with full keyboard support using arrow keys, Home, and End.
tech: react@19.0.0
---

Carousels are common in product galleries, testimonials, and image sliders. The problem is that most carousel implementations ignore keyboard users entirely, making them inaccessible to people who rely on keyboards or assistive technologies.

An accessible carousel needs proper ARIA roles, keyboard navigation with arrow keys, and the ability to jump to the start or end. It also needs to track scroll position to enable or disable navigation buttons appropriately. Let's build one using React's Context API and a [compound component pattern](/articles/compound-component-pattern-in-react).

## Create the Carousel Context

Start by defining the context that will hold the carousel state and navigation functions:

```tsx {% path="components/carousel.tsx" %}
import type { ComponentProps, KeyboardEvent, ReactNode, RefObject } from "react";
import { createContext, useContext, useEffect, useId, useRef, useState } from "react";

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
```

The context holds references to the viewport element, scroll state booleans, and navigation functions. The `useCarouselContext` hook ensures components are used correctly within the carousel.

## Build the Root Carousel Component

The root component sets up the context provider and tracks scroll position using `ResizeObserver`:

```tsx {% path="components/carousel.tsx" %}
export function Carousel({ className, id, ...props }: ComponentProps<"section">) {
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
			<section {...props} id={id} role="region" aria-roledescription="carousel">
				{props.children}
			</section>
		</CarouselContext.Provider>
	);
}
```

The `ResizeObserver` recalculates scroll state when the viewport size changes, handling responsive layouts. The scroll event listener updates state as users scroll manually. Using `AbortController` for cleanup is cleaner than storing event handler references.

## Add Keyboard Navigation to the Viewport

The viewport component handles keyboard events for arrow keys, Home, and End:

```tsx {% path="components/carousel.tsx" %}
Carousel.Viewport = function CarouselViewport({ onKeyDown, ...props }: ComponentProps<"div">) {
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
			tabIndex={props.tabIndex ?? 0}
			onKeyDown={handleKeyDown}
		/>
	);
};
```

The `tabIndex={0}` makes the viewport focusable, enabling keyboard navigation. Arrow keys scroll by one viewport width, while Home and End jump to the start or end. Calling `onKeyDown?.(event)` first allows consumers to add custom keyboard handling.

## Create the Track and Slide Components

The track holds slides in a horizontal layout, and each slide has proper ARIA semantics:

```tsx {% path="components/carousel.tsx" %}
Carousel.Track = function CarouselTrack(props: ComponentProps<"div">) {
	return <div {...props} />;
};

Carousel.Slide = function CarouselSlide(props: ComponentProps<"div">) {
	return <div {...props} role="group" aria-roledescription="slide" />;
};
```

Each slide uses `role="group"` and `aria-roledescription="slide"` so screen readers announce them correctly. The track is a simple container that you style with CSS to create the horizontal scroll layout.

## Build the Navigation Controls

The previous and next buttons read scroll state from context to enable or disable themselves:

```tsx {% path="components/carousel.tsx" %}
Carousel.Previous = function CarouselPrevious({ children, ...props }: ComponentProps<"button">) {
	let { viewportId, scrollPrev, canScrollPrev } = useCarouselContext("Carousel.Previous");

	return (
		<button
			{...props}
			type="button"
			aria-label="Previous slide"
			aria-controls={viewportId}
			disabled={!canScrollPrev}
			onClick={scrollPrev}
		>
			{children ?? "Previous"}
		</button>
	);
};

Carousel.Next = function CarouselNext({ children, ...props }: ComponentProps<"button">) {
	let { viewportId, scrollNext, canScrollNext } = useCarouselContext("Carousel.Next");

	return (
		<button
			{...props}
			type="button"
			aria-label="Next slide"
			aria-controls={viewportId}
			disabled={!canScrollNext}
			onClick={scrollNext}
		>
			{children ?? "Next"}
		</button>
	);
};
```

The `aria-controls` attribute links buttons to the viewport they control. Buttons disable automatically when there's nothing to scroll to, preventing users from clicking buttons that do nothing.

## Use the Carousel Component

Here's how to use all the pieces together:

```tsx {% path="app/routes/products.tsx" %}
import { Carousel } from "~/components/carousel";

export default function ProductsPage() {
	return (
		<Carousel>
			<Carousel.Viewport className="overflow-x-auto">
				<Carousel.Track className="flex gap-4">
					<Carousel.Slide className="min-w-[300px]">
						<img src="/product-1.jpg" alt="Product 1" />
					</Carousel.Slide>
					<Carousel.Slide className="min-w-[300px]">
						<img src="/product-2.jpg" alt="Product 2" />
					</Carousel.Slide>
					<Carousel.Slide className="min-w-[300px]">
						<img src="/product-3.jpg" alt="Product 3" />
					</Carousel.Slide>
				</Carousel.Track>
			</Carousel.Viewport>

			<div className="flex gap-2 mt-4">
				<Carousel.Previous>Previous</Carousel.Previous>
				<Carousel.Next>Next</Carousel.Next>
			</div>
		</Carousel>
	);
}
```

The compound component pattern keeps the API flexible. You control the layout and styling while the carousel handles accessibility and keyboard navigation. For a cleaner import syntax, you can organize these subcomponents using [TypeScript namespaces](/tutorials/simplify-component-imports-with-typescript-namespaces).

## Final Thoughts

This carousel implementation covers the essential accessibility requirements: proper ARIA roles, keyboard navigation with arrow keys and Home/End, and automatic button state management. The `ResizeObserver` ensures the scroll state stays accurate across responsive breakpoints. You can apply the same observer techniques to build [animated tab indicators with CSS variables](/tutorials/create-animated-tab-indicators-with-css-variables).

For more complex use cases, you might add features like autoplay with pause on hover, dot indicators, or touch swipe gestures. The compound component pattern makes these additions straightforward without changing the core API.
