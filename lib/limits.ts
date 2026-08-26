/** Shared input limits — imported by both API routes and client components. */

/** Anything longer is a paste accident, not a brain dump. */
export const MAX_BRAIN_DUMP_CHARS = 10_000

/**
 * Brain-dump / `capture` calls allowed per user per UTC day.
 *
 * The number exists because of the connector: a person with a textarea does not
 * press the button twenty times, and a model deciding for itself how often to
 * call `capture` can. It is one budget across both — the tool and the textarea
 * go through the same helper in `lib/brain-dump.ts`, so twenty is twenty however
 * the call arrived.
 */
export const MAX_CAPTURES_PER_DAY = 20
