/**
 * Recording `Queue` binding. Producers' sends are captured for assertions, and
 * `consume()` drives a real consumer handler with the platform's `ack`/`retry` semantics
 * so both the enqueue side and the delivery side can be tested without a live queue.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
/** Largest batch the platform accepts from `sendBatch`. */
const MAXIMUM_BATCH_SIZE = 100;

/** Byte budget for a single message body (128 KiB). */
const MAXIMUM_MESSAGE_BYTES = 128 * 1024;

/** Longest delivery delay the platform accepts, in seconds (12 hours). */
const MAXIMUM_DELAY_SECONDS = 43200;

/** Messages delivered per `consume()` pass when no batch size is given. */
const DEFAULT_MAX_BATCH_SIZE = 10;

/** Retries the platform performs before a message is dead-lettered. */
const DEFAULT_MAX_RETRIES = 3;

/** A sent message plus the delivery bookkeeping a consumer observes. */
export interface QueueMessageRecord<Body = unknown> {
	/** Identifier handed to the consumer as `message.id`. */
	id: string;
	/** Time the producer sent the message. */
	timestamp: Date;
	/** Body exactly as the producer passed it. */
	body: Body;
	/** Delivery count so far; `0` until the message is first consumed. */
	attempts: number;
	/** Content type the producer requested, when it set one. */
	contentType?: QueueContentType;
	/** Delivery delay the producer requested, when it set one. */
	delaySeconds?: number;
}

/** Outcome of one {@link QueueMock.consume} pass. */
export interface QueueConsumeResult<Body = unknown> {
	/** Messages handed to the handler in this batch. */
	delivered: QueueMessageRecord<Body>[];
	/** Messages the handler acknowledged, explicitly or by returning successfully. */
	acked: QueueMessageRecord<Body>[];
	/** Messages returned to the queue for another delivery. */
	retried: QueueMessageRecord<Body>[];
	/** Messages that exhausted their retries and were dead-lettered. */
	deadLettered: QueueMessageRecord<Body>[];
}

/** Something holding deferred work that must finish before dispositions are read. */
export interface DeferredWork {
	/** Awaits every promise registered so far, including ones registered while awaiting. */
	settled(): Promise<void>;
}

/** Options for a single {@link QueueMock.consume} pass. */
export interface QueueConsumeOptions {
	/** Messages to deliver in this batch; defaults to the queue's configured size. */
	maxBatchSize?: number;

	/**
	 * Deferred work to drain after the handler returns, before dispositions
	 * are applied — a handler's real `ack`/`retry` calls inside `waitUntil`
	 * land only once this settles, so the pass must wait for it to read them.
	 */
	context?: DeferredWork;
}

/** Consumer handler shape a Worker exports as its `queue` handler. */
export type QueueConsumer<Body = unknown> = (batch: MessageBatch<Body>) => void | Promise<void>;

/** Options for {@link createQueue}. */
export interface QueueMockOptions {
	/** Queue name reported to consumers as `batch.queue`. */
	name?: string;
	/** Deliveries per `consume()` pass. Defaults to 10, as the platform does. */
	maxBatchSize?: number;
	/** Retries before a message is dead-lettered. Defaults to 3, as the platform does. */
	maxRetries?: number;
}

/** A `Queue` binding that records sends and can drive a consumer. */
export interface QueueMock<Body = unknown> extends Queue<Body> {
	/** Messages waiting to be delivered, oldest first. */
	readonly messages: QueueMessageRecord<Body>[];
	/** Every message ever sent, including ones already consumed. */
	readonly sent: QueueMessageRecord<Body>[];
	/** Messages that exhausted their retries. */
	readonly deadLetter: QueueMessageRecord<Body>[];

	/**
	 * Discards every recorded message, pending or delivered, as if the queue
	 * were new, so `beforeEach` resets a module-scoped binding without
	 * recreating the captured `env`.
	 */
	reset(): void;

	/**
	 * Delivers one batch to a consumer handler and applies its `ack`/`retry`
	 * decisions, defaulting undecided messages to acked and retrying everything
	 * when the handler throws; a thrown error is rethrown after retries apply.
	 * @param handler Consumer handler to invoke with the batch.
	 * @param options Per-pass batch size override, and deferred work to drain.
	 * @returns What happened to each delivered message.
	 */
	consume(
		handler: QueueConsumer<Body>,
		options?: QueueConsumeOptions,
	): Promise<QueueConsumeResult<Body>>;
}

/**
 * Creates a recording queue binding. Validates sends the way the platform
 * does, then queues them in memory, so send and consume behavior are both
 * testable without a live queue.
 * @param options Queue name, batch size, and retry budget.
 * @returns A `Queue` binding that records sends and drives consumers.
 * @example let queue = createQueue<{ id: string }>(); await queue.send({ id: "1" });
 * @example await queue.consume(async (batch) => { for (let m of batch.messages) m.retry(); });
 */
export function createQueue<Body = unknown>(options?: QueueMockOptions): QueueMock<Body> {
	let name = options?.name ?? "mock-queue";
	let maxBatchSize = options?.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE;
	let maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;

	let pending: QueueMessageRecord<Body>[] = [];
	let sent: QueueMessageRecord<Body>[] = [];
	let deadLetter: QueueMessageRecord<Body>[] = [];

	/** Queues one message after validating it the way the producer API does. */
	function enqueue(body: Body, contentType?: QueueContentType, delaySeconds?: number): void {
		assertMessageSize(body);
		assertDelay(delaySeconds);

		let record: QueueMessageRecord<Body> = {
			id: createMessageId(),
			timestamp: new Date(),
			body,
			attempts: 0,
		};

		if (contentType !== undefined) record.contentType = contentType;
		if (delaySeconds !== undefined) record.delaySeconds = delaySeconds;

		pending.push(record);
		sent.push(record);
	}

	/** Backlog metrics shared by `send`, `sendBatch`, and `metrics`. */
	function readMetrics(): QueueMetrics {
		let oldest = pending[0];

		let metrics: QueueMetrics = {
			backlogCount: pending.length,
			backlogBytes: pending.reduce((total, record) => total + measureBody(record.body), 0),
		};

		if (oldest) metrics.oldestMessageTimestamp = oldest.timestamp;

		return metrics;
	}

	return {
		get messages(): QueueMessageRecord<Body>[] {
			return [...pending];
		},

		get sent(): QueueMessageRecord<Body>[] {
			return [...sent];
		},

		get deadLetter(): QueueMessageRecord<Body>[] {
			return [...deadLetter];
		},

		reset(): void {
			pending.length = 0;
			sent.length = 0;
			deadLetter.length = 0;
		},

		/**
		 * Queues one message.
		 * @param message Body to enqueue.
		 * @param sendOptions Content type and delivery delay.
		 * @returns Backlog metrics as of the send.
		 */
		async send(message: Body, sendOptions?: QueueSendOptions): Promise<QueueSendResponse> {
			enqueue(message, sendOptions?.contentType, sendOptions?.delaySeconds);
			return { metadata: { metrics: readMetrics() } };
		},

		/**
		 * Queues many messages, rejecting a batch larger than the platform accepts.
		 * @param messages Send requests, each with its own optional content type and delay.
		 * @param batchOptions Delay applied to requests that do not set their own.
		 * @returns Backlog metrics as of the send.
		 */
		async sendBatch(
			messages: Iterable<MessageSendRequest<Body>>,
			batchOptions?: QueueSendBatchOptions,
		): Promise<QueueSendBatchResponse> {
			let requests = [...messages];

			if (requests.length > MAXIMUM_BATCH_SIZE) {
				throw new Error(
					`Queue send failed: batch of ${String(requests.length)} exceeds the limit of ${String(MAXIMUM_BATCH_SIZE)} messages`,
				);
			}

			for (let request of requests) {
				enqueue(
					request.body,
					request.contentType,
					request.delaySeconds ?? batchOptions?.delaySeconds,
				);
			}

			return { metadata: { metrics: readMetrics() } };
		},

		/** Current backlog metrics. */
		async metrics(): Promise<QueueMetrics> {
			return readMetrics();
		},

		async consume(
			handler: QueueConsumer<Body>,
			consumeOptions?: QueueConsumeOptions,
		): Promise<QueueConsumeResult<Body>> {
			let size = consumeOptions?.maxBatchSize ?? maxBatchSize;
			let delivered = pending.splice(0, size);

			for (let record of delivered) record.attempts += 1;

			let acked = new Set<QueueMessageRecord<Body>>();
			let retried = new Set<QueueMessageRecord<Body>>();

			let batch: MessageBatch<Body> = {
				queue: name,
				metadata: { metrics: readMetrics() },
				messages: delivered.map((record) => createMessage(record, acked, retried)),

				/** Acknowledges every message in the batch. */
				ackAll(): void {
					for (let record of delivered) {
						retried.delete(record);
						acked.add(record);
					}
				},

				/** Returns every not-yet-acked message in the batch to the queue. */
				retryAll(): void {
					for (let record of delivered) {
						if (!acked.has(record)) retried.add(record);
					}
				},
			};

			let failure: unknown;

			try {
				await handler(batch);
				await consumeOptions?.context?.settled();
			} catch (error) {
				failure = error;
				for (let record of delivered) {
					if (!acked.has(record)) retried.add(record);
				}
			}

			let requeued: QueueMessageRecord<Body>[] = [];
			let expired: QueueMessageRecord<Body>[] = [];

			for (let record of delivered) {
				if (!retried.has(record)) continue;

				if (record.attempts > maxRetries) {
					deadLetter.push(record);
					expired.push(record);
					continue;
				}

				pending.push(record);
				requeued.push(record);
			}

			if (failure !== undefined) throw failure;

			return {
				delivered,
				acked: delivered.filter((record) => !retried.has(record)),
				retried: requeued,
				deadLettered: expired,
			};
		},
	};
}

/**
 * Wraps a queued record as the `Message` a consumer receives.
 *
 * `ack` and `retry` are last-write-wins on the same message, matching the platform: a
 * message acked and then retried is retried.
 */
function createMessage<Body>(
	record: QueueMessageRecord<Body>,
	acked: Set<QueueMessageRecord<Body>>,
	retried: Set<QueueMessageRecord<Body>>,
): Message<Body> {
	return {
		id: record.id,
		timestamp: record.timestamp,
		body: record.body,
		attempts: record.attempts,

		/** Marks the message as processed so it leaves the queue. */
		ack(): void {
			retried.delete(record);
			acked.add(record);
		},

		/** Returns the message to the queue for another delivery attempt. */
		retry(): void {
			acked.delete(record);
			retried.add(record);
		},
	};
}

/** Generates an opaque message id shaped like the platform's. */
function createMessageId(): string {
	return crypto.randomUUID().replaceAll("-", "");
}

/** Approximates a body's serialized size, the number the platform's limit applies to. */
function measureBody(body: unknown): number {
	if (typeof body === "string") return new TextEncoder().encode(body).byteLength;
	if (body instanceof ArrayBuffer) return body.byteLength;
	if (ArrayBuffer.isView(body)) return body.byteLength;

	return new TextEncoder().encode(JSON.stringify(body) ?? "").byteLength;
}

/** Rejects a body larger than the platform's per-message limit. */
function assertMessageSize(body: unknown): void {
	let size = measureBody(body);

	if (size > MAXIMUM_MESSAGE_BYTES) {
		throw new Error(
			`Queue send failed: message of ${String(size)} bytes exceeds the limit of ${String(MAXIMUM_MESSAGE_BYTES)} bytes`,
		);
	}
}

/** Rejects a delivery delay outside the range the platform accepts. */
function assertDelay(delaySeconds: number | undefined): void {
	if (delaySeconds === undefined) return;

	if (delaySeconds < 0 || delaySeconds > MAXIMUM_DELAY_SECONDS) {
		throw new Error(
			`Queue send failed: delaySeconds must be between 0 and ${String(MAXIMUM_DELAY_SECONDS)}`,
		);
	}
}
