# Command Surface

This bot keeps command categories aligned with the way users navigate the product.

## Categories

- `Economy`
  - `balance`
  - `daily`
  - `deposit`
  - `leaderboard`
  - `pay`
  - `steal`
  - `withdraw`
- `Games`
  - `blackjack`
  - `coin`
  - `dice`
  - `fish`
- `Utilities`
  - `help`
  - `ping`
  - `support`
  - `user`
- `Admin`
  - `economy`
  - `restocklake`
  - `syncroles`

## Surface Rules

- Keep command names short, stable, and category-appropriate.
- Keep option names descriptive and consistent across similar commands.
- Keep help output grouped by these product areas.
- Move commands when the user mental model is clearer than the implementation history.

## Response Shape

- Economy and game commands should prefer the shared balance/status embed helpers.
- Guild-only commands should reject direct messages with a single consistent error response.
- Destructive admin flows should show an explicit preview before applying changes.
