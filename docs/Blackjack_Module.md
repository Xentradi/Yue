# Blackjack Module

Blackjack is intentionally structured as a thin command wrapper plus a single game module.

## Files

- `src/commands/gamble/blackjack.js` registers the slash command and delegates execution.
- `src/modules/games/blackjackGame.js` contains the game flow, state, deck logic, and response rendering.
- `test/blackjack.test.js` covers the pure helper functions so the rules stay stable.

## Game Flow

1. Verify the command is being used in a guild.
2. Validate the bet amount.
3. Load the player and ensure they have enough cash.
4. Classify the player using guild-scoped net worth data, using `cash + bank - debt`.
5. Deal the opening hands.
6. Handle natural blackjack immediately when it occurs.
7. Otherwise, start the hit/stand collector.
8. Resolve the final hand values and update the player balance.
9. Render the result with the shared balance embed helper.

## Helper Responsibilities

- `calculateValue(hand)` calculates blackjack hand totals with ace adjustment.
- `createDeck(numDecks)` builds a shuffled deck source.
- `drawGoodCard(deck)` and `drawBadCard(deck)` support the current odds modifiers.
- `hasBetterOdds(userId)` and `hasWorseOdds(userId)` track temporary odds state.
- `updateOddsState(userId, comparison, isPremium)` applies the current odds classification.

## Response Pattern

- Invalid or unavailable game states use `createStatusEmbed`.
- In-progress hands use the blackjack response in `blackjackGame.js` with button components.
- Finished games use `createBalanceEmbed`, which renders the balance summary and the outcome together.
- Collector timeout results reuse the same final result path and only add a timeout footer.

## Uniformity Notes

The command module should stay thin. If new blackjack rules are added later, they should go in the game module rather than back into the slash command.
