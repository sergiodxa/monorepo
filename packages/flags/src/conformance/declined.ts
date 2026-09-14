/**
 * The two halves of the conformance ledger: the requirements this package will
 * never owe, each naming the condition that excuses it, and the ones it owes
 * but has not covered yet. Keys are the requirement number as
 * `specification.json` writes it, without the `Requirement` prefix.
 *
 * A requirement leaves `PENDING` when a test is named for it; nothing leaves
 * `DECLINED` while the condition beside it still fails to hold.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Permanently not owed. Every entry names the condition whose failing to hold
 * is what excuses it — the static-context paradigm this package is not, a type
 * system that does not separate integers from floats, a reserved word that is
 * not reserved here.
 */
export const DECLINED: Record<string, string> = {
	"1.1.1":
		"Requirement 1.8's isolated instances are the only shape there is, so no global singleton exists to satisfy it (ADR-059 decision 4).",
	"1.3.2.1":
		"Condition 1.3.2 does not hold: this implementation uses the dynamic-context paradigm.",
	"1.3.3.1":
		"Condition 1.3.3 does not hold: TypeScript has one `number`, so there is no integer method to add.",
	"1.4.2.1":
		"Condition 1.4.2 does not hold: this implementation uses the dynamic-context paradigm.",
	"1.7.2.1": "Condition 1.7.2 does not hold: `RECONCILING` belongs to the static-context paradigm.",
	"2.8.4":
		"`on context changed` is a static-context capability this package does not define, so no provider has one to terminate.",
	"3.2.2.1":
		"Condition 3.2.2 does not hold: this implementation uses the dynamic-context paradigm.",
	"3.2.2.2":
		"Condition 3.2.2 does not hold: the client and the invocation both supply context here.",
	"3.2.2.3":
		"Condition 3.2.2 does not hold: this implementation uses the dynamic-context paradigm.",
	"3.2.2.4":
		"Condition 3.2.2 does not hold: this implementation uses the dynamic-context paradigm.",
	"3.2.4.1":
		"Condition 3.2.4 does not hold: this implementation uses the dynamic-context paradigm.",
	"3.2.4.2":
		"Condition 3.2.4 does not hold: this implementation uses the dynamic-context paradigm.",
	"3.3.2.1":
		"Condition 3.3.2 does not hold: Condition 3.3.1 is the one that applies, and the propagator ships.",
	"4.3.3.1":
		"Condition 4.3.3 does not hold: this implementation uses the dynamic-context paradigm.",
	"4.3.9.1":
		"Condition 4.3.9 does not hold: `finally` is a legal property name, so the stage keeps that name.",
	"5.3.4.1":
		"Condition 5.3.4 does not hold: this implementation uses the dynamic-context paradigm.",
	"5.3.4.2":
		"Condition 5.3.4 does not hold: this implementation uses the dynamic-context paradigm.",
	"5.3.4.3":
		"Condition 5.3.4 does not hold: this implementation uses the dynamic-context paradigm.",
	"6.1.2.1":
		"Condition 6.1.2 does not hold: this implementation uses the dynamic-context paradigm.",
};

/**
 * Owed and not yet covered. An id lands here the moment the specification asks
 * for something nothing has said anything about yet, and leaves it once the
 * test named for it lands, lowering `PENDING_BASELINE` with it.
 */
export const PENDING: Record<string, string> = {};
