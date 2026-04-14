# Roadmap

This roadmap is ordered for the current maintenance pass. Stability work comes before feature work.

## Epic 1: Runtime Modernization

### Milestone 1.1: Node 24 LTS compatibility

- [P0] Confirm the bot boots cleanly on Node 24 LTS
- [P0] Keep startup validation for required environment variables
- [P1] Verify native modules build or document the required local toolchain

### Milestone 1.2: Dependency triage

- [P1] Review packages that are duplicated, stale, or no longer needed
- [P1] Identify packages that should be replaced before any upgrade
- [P2] Track dependency update candidates separately from code changes

## Epic 2: Safety and Stability

### Milestone 2.1: Command reliability

- [P0] Remove private Discord.js usage and other brittle interaction handling
- [P0] Make async command paths wait for work to finish before replying success
- [P1] Add guards for DM handling, missing members, and partial data

### Milestone 2.2: Data integrity

- [P0] Fix schema methods that rely on the wrong `this` binding
- [P0] Review transaction helpers and make them consistent with the current data model
- [P1] Add validation for negative balances, invalid states, and missing documents

### Milestone 2.3: Scheduled jobs

- [P1] Confirm scheduled interest and restock jobs still run as expected
- [P1] Add clearer failure logging for scheduled tasks
- [P2] Decide whether any scheduled job should become configurable

## Epic 3: Documentation Cleanup

### Milestone 3.1: Keep docs current

- [P0] Remove setup steps that do not exist in the codebase
- [P0] Keep README and setup docs short and accurate
- [P1] Align examples with the current command deploy flow

### Milestone 3.2: Maintenance docs

- [P1] Document the current configuration surface in one place
- [P2] Add a short operator note for deployment, logs, and backups

## Epic 4: Test Coverage

### Milestone 4.1: Baseline checks

- [P1] Add smoke tests for startup and command registration
- [P1] Add tests for balance, loan, and transfer flows
- [P2] Add coverage for scheduled tasks and leaderboard queries

### Deferred hardening

These are the next stability follow-ups after admin balance hardening lands.

- [P2] Harden fishing and lake flows against save-order inconsistencies
- [P2] Add tests for steal behavior and scheduled maintenance paths

## Epic 5: Feature Backlog

These items stay behind runtime, safety, and documentation work.

- [P3] Expand gambling features
- [P3] Expand economy depth
- [P3] Add quality-of-life improvements such as a dashboard
- [P4] Add nonessential social features

## Priority Guide

- [P0] Must fix before any release or dependency upgrade
- [P1] Should fix during the current maintenance pass
- [P2] Good next step after the core path is stable
- [P3] Backlog
- [P4] Low-priority idea
