# Command and Response Conventions

This document defines the response patterns used across Yue so command behavior stays uniform.

## Command Shape

Slash commands should follow the same basic flow:

1. Validate the context first.
2. Guard guild-only commands with `interaction.inGuild()`.
3. Defer the reply when the command does real work.
4. Call a module in `src/modules/`.
5. Reply or edit the reply with a consistent embed.

## Response Types

Use the shared helpers from `src/utils/economyFeedback.js`:

- `createBalanceEmbed` for success states that change or report money, bank, debt, or net worth (`cash + bank - debt`).
- `createStatusEmbed` for errors, warnings, empty states, and informational replies.
- `createConfirmationEmbed` for destructive admin previews.

## Copy Rules

- Keep titles short and specific.
- Use the same noun for the same feature across commands.
- Prefer `balance`, `bank`, `debt`, `reward`, `transfer`, and `leaderboard` consistently.
- Keep failure messages actionable and direct.
- Use ephemeral replies for permission failures and other context checks that do not need public visibility.

## Standard Outcomes

### Success

- Show the resulting values when money or state changes.
- Include a concise description of what changed.
- Avoid duplicating the same information in both the description and fields.

### Failure

- Use a short title such as `❌ Operation Failed` or a feature-specific variant.
- Put the reason in the description.
- Prefer one recovery hint if it helps the user retry correctly.

### Confirmation

- Use a warning title.
- Describe the destructive action before it happens.
- Keep the preview explicit about the target, field, and amount.

## Blackjack-Specific Rules

Blackjack now follows the same pattern as the rest of the bot:

- The slash command is a thin wrapper in `src/commands/gamble/blackjack.js`.
- The game engine lives in `src/modules/games/blackjackGame.js`.
- Shared helper exports cover card values, deck creation, and odds selection.
- Final round results use `createBalanceEmbed` so the balance summary matches other economy-visible commands.
- Failures use `createStatusEmbed` so the error style matches other commands.

## Maintenance Rule

If a command starts building its own one-off response style, move that formatting back into the shared helpers or the relevant module before the pattern spreads.
