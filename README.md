# Yue

## Testing

We have built a comprehensive test suite for the bot. Here's a summary of what's covered:

1. Core economy functions (fetchBalance, initialize, setBalance)
2. Game modules (blackjack, coinFlip, diceRoll, fishing)
3. Utility functions (logger, characterUtils)
4. Main models (User, Character, Bank)
5. Event handler (interactionCreate)
6. Command handler
7. Scheduled tasks

### Running Tests

To ensure the bot is fully functional after each update before pushing to production, follow these steps:

1. Run the entire test suite:
   ```
   npm test
   ```
   This will run all tests and show you if any tests are failing.

2. Check the test coverage:
   ```
   npm run test:coverage
   ```
   This will run the tests and generate a coverage report, showing you which parts of the code are well-tested and which might need more testing.

3. Run the linter:
   ```
   npm run lint
   ```
   This will check for any code style issues or potential problems.

4. If you're actively developing, you can use the watch mode:
   ```
   npm run test:watch
   ```
   This will re-run tests automatically as you make changes to the code.

5. Before committing your changes, run the pre-commit checks:
   ```
   npm run precommit
   ```
   This will run both the linter and the tests, ensuring that your code is ready for commit.

By following these steps before pushing to production, you can catch potential issues early and ensure that the bot remains functional after updates. Remember to regularly update and expand the test suite as you add new features or modify existing ones.
