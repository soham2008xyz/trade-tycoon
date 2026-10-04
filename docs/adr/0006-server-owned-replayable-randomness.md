# The server owns randomness, and a retried action replays the same roll

Dice rolls and card draws come from an injectable rng passed to the reducer. In online play the server strips any dice values a client sends, so a player cannot choose a favourable roll, and it supplies its own seeded generator. The seed is generated once, outside the store's compare-and-swap mutator, and a fresh generator is built from it on each invocation. If a Redis conflict makes the mutator run again, it replays the identical roll or draw instead of silently re-rolling. Hotseat play passes no rng and falls back to `Math.random`.

## Considered options

- **Pre-rolling the dice and pre-drawing cards outside the mutator.** Rejected because a card draw depends on the tile the player lands on, which can change between retries, so the draw could not be fixed in advance.

## Consequences

- Drawing a card makes exactly one rng call, even when a held Get Out of Jail Free card is excluded from the pool. Server tests script rng sequences, so changing the number of calls per draw breaks them.
- Tests pass a seeded generator rather than relying on `Math.random`, otherwise roll tests are flaky.
