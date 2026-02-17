---
title: Use Case Pattern vs Service Layer
excerpt: Understand the difference between use cases and services to organize your business logic effectively.
technologies: react-router@7.0.0
---

Most applications start with business logic scattered across route handlers. A form submission triggers validation, database queries, API calls, and email notifications, all in the same function. This works until it doesn't.

The question isn't whether to extract this logic, but how to organize it. Two patterns emerge: **services** and **use cases**. They solve different problems, and understanding when to use each leads to cleaner, more maintainable code.

## Services: Reusable Operations

A service wraps a specific capability, often an external API or database access. It provides a clean interface for a single responsibility. For a deeper exploration of the service layer pattern in React Router apps, see [organizing business logic into services](/articles/the-service-layer-pattern-in-react-router-apps).

```ts {% path="app/services/email.ts" %}
class EmailService {
	async send(to: string, subject: string, body: string) {
		// Wraps the email provider API
	}

	async sendTemplate(to: string, templateId: string, data: Record<string, unknown>) {
		// Sends a templated email
	}
}
```

Services are **reusable building blocks**. Multiple parts of your application can use the same email service. They don't know about business rules; they just know how to send emails.

Another example is a service wrapping a third-party API:

```ts {% path="app/services/newsletter.ts" %}
class NewsletterService {
	async isSubscribed(email: string): Promise<boolean> {
		const response = await this.get(`/subscribers/${email}`);
		return response.ok;
	}

	async subscribe(email: string, metadata: Record<string, string>) {
		await this.post("/subscribers", { body: JSON.stringify({ email, ...metadata }) });
	}
}
```

The service handles authentication, request formatting, and error parsing. It doesn't decide _when_ to subscribe someone or _what_ to do after, it just knows _how_ to interact with the newsletter API.

## Use Cases: Business Operations

A use case represents a single business operation. It coordinates multiple services to accomplish a specific goal.

```ts {% path="app/use-case/subscribe-user.ts" %}
export async function subscribeUser(email: string, source: string): Promise<Result<string, Error>> {
	// Check if already subscribed
	if (await newsletter.isSubscribed(email)) {
		return success("Already subscribed");
	}

	// Subscribe the user
	await newsletter.subscribe(email, { source });

	// Log the event
	logger.info("user_subscribed", { email, source });

	return success("Subscribed");
}
```

The use case **orchestrates** the operation. It calls the newsletter service to check subscription status, subscribes if needed, and logs the event. Each step involves a service, but the use case defines the business flow.

Use cases are **not reusable** in the same way services are. They represent a specific action in your application. If you need a different subscription flow for a different context, you create a new use case.

## The Key Difference

Services answer: "How do I interact with X?"

Use cases answer: "What happens when a user does Y?"

A service is a **capability**. A use case is a **workflow**.

Consider a checkout process. You might have services for:

- Payment processing
- Inventory management
- Email notifications
- Analytics tracking

The "complete purchase" use case coordinates all of them:

```ts {% path="app/use-case/complete-purchase.ts" %}
export async function completePurchase(
	cart: Cart,
	paymentMethod: PaymentMethod,
): Promise<Result<Order, Error>> {
	// Verify inventory
	let availability = await inventory.checkAvailability(cart.items);
	if (!availability.allAvailable) {
		return failure(new Error("Some items are out of stock"));
	}

	// Process payment
	let payment = await payments.charge(paymentMethod, cart.total);
	if (isFailure(payment)) {
		return payment;
	}

	// Reserve inventory
	await inventory.reserve(cart.items);

	// Create order
	let order = await orders.create(cart, payment.data);

	// Send confirmation
	await email.sendTemplate(cart.userEmail, "order-confirmation", { order });

	// Track analytics
	analytics.track("purchase_completed", { orderId: order.id, total: cart.total });

	return success(order);
}
```

Each service does one thing. The use case defines the business process.

## When to Use Each

**Create a service when:**

- You need to wrap an external API
- Multiple use cases need the same capability
- The operation is purely technical (no business decisions)

**Create a use case when:**

- You're implementing a user action or business process
- The operation involves multiple steps or services
- Business rules determine the flow

## Layering in Practice

In a typical application, the layers look like this:

```txt
Route Handler → Use Case → Services → External APIs/Database
```

The route handler validates input and calls the use case. The use case implements the business logic using services. Services interact with external systems.

```ts {% path="app/routes/subscribe.ts" %}
export async function action({ request }: Route.ActionArgs) {
	let formData = await request.formData();
	let email = formData.get("email");

	// Validate input
	if (!email || typeof email !== "string") {
		return { error: "Email is required" };
	}

	// Call the use case
	let result = await subscribeUser(email, "website");

	if (isFailure(result)) {
		return { error: result.error.message };
	}

	return { message: result.data };
}
```

The route handler doesn't know about the newsletter API. The use case doesn't know about HTTP requests. Each layer has a single responsibility.

## Avoiding Common Mistakes

**Don't put business logic in services.** If your email service decides _when_ to send welcome emails, it's doing too much. That decision belongs in a use case.

**Don't skip the use case layer.** Calling services directly from route handlers works initially, but business logic inevitably creeps into handlers. Extract it early.

**Don't make use cases too granular.** A use case should represent a complete business operation, not a single step. "Check if user is subscribed" is a service method. "Subscribe user to newsletter" is a use case.

## Testing Benefits

This separation makes testing straightforward.

Test services by mocking external APIs:

```ts {% path="app/services/newsletter.test.ts" %}
test("subscribe sends correct payload", async () => {
	let mockFetch = vi.fn().mockResolvedValue({ ok: true });
	let service = new NewsletterService({ fetch: mockFetch });

	await service.subscribe("test@example.com", { source: "website" });

	expect(mockFetch).toHaveBeenCalledWith(
		expect.stringContaining("/subscribers"),
		expect.objectContaining({
			body: expect.stringContaining("test@example.com"),
		}),
	);
});
```

Test use cases by mocking services:

```ts {% path="app/use-case/subscribe-user.test.ts" %}
test("returns already subscribed for existing users", async () => {
	vi.mocked(newsletter.isSubscribed).mockResolvedValue(true);

	let result = await subscribeUser("existing@example.com", "website");

	expect(result).toEqual(success("Already subscribed"));
	expect(newsletter.subscribe).not.toHaveBeenCalled();
});
```

Each layer can be tested in isolation. This separation aligns with the principles of [designing for testability](/articles/designing-for-testability-in-serverless-functions), where pure functions and explicit dependencies make testing straightforward.

## Final Thoughts

Services and use cases aren't competing patterns. They complement each other. Services provide the building blocks. Use cases assemble them into business operations.

Start with use cases when you notice business logic spreading across your route handlers. Extract services when you find yourself duplicating API interactions or database queries.

The goal isn't architectural purity. It's code that's easy to understand, test, and modify. When someone asks "what happens when a user subscribes?", you should be able to point to a single file that answers that question completely.
