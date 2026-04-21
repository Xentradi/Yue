# Game Roadmap

This document defines the intended game structure for Yue’s long-term wuxia/xanxia systems. It is the place for stable design decisions, not temporary implementation notes.

## Core Concepts

- `Player` progress is global and bound to the Discord user account, not to any one Discord server.
- `Clan` is a Discord server that has explicitly opted into Yue clan support.
- `Wanderer` is a player who is not currently a member of any clan.
- `Alignment` is the player’s moral axis and can be righteous, neutral, or demonic.
- `Virtue` is the numeric moral score that drives alignment shifts.
- `Reputation` is player-to-player social standing.

## Player Rules

- A player may belong to only one clan at a time.
- A player may be in many Discord servers that run Yue, but only one clan membership is active at once.
- A player who has no clan membership is a wanderer.
- Wanderers use public resources instead of clan-only resources.
- Joining a new clan has a 24-hour cooldown after leaving the previous clan.
- Players can choose their alignment, but the system may shift or suggest alignment changes based on virtue.

## Virtue And Alignment

- Virtue uses a `-1000..1000` scale.
- `0` is neutral.
- Positive virtue leans righteous.
- Negative virtue leans demonic.
- Small negative or positive values are not instant enemy flags; the system should use a gradient of hostility.
- Alignment should not flip on tiny score changes.
- The system should define thresholds for mild, moderate, and extreme righteous/demonic states.

## Clan Rules

- Clan alignment is chosen by the clan and is either righteous or demonic.
- Clan virtue is system-driven and reflects the clan’s moral direction.
- Clan recruitment can be open, but players still must opt in.
- Clan membership should be an explicit state, not inferred from server membership alone.
- The main Yue server should still be able to display both alignment and clan identity for each player.
- Open recruitment should prompt wanderers who enter the clan server, but only through an opt-in flow.
- Closed recruitment should require a clan officer or leader to invite the player directly.
- Invite flows should use a private delivery path when possible, ideally a DM with Join and Decline buttons.

## Reputation Rules

- Players can raise or lower other players’ reputation.
- Reputation is social trust, not morality.
- Reputation should remain separate from virtue so clan ethics and player relationships do not collapse into one score.

## Resources

- Public resources are available to wanderers and clan members alike.
- Clan resources are reserved for members of that clan.
- The clan benefit is exclusivity and future clan-specific systems, not basic access to the game.
- The lake system should eventually support both public and clan-specific tiers.

## Banking And Finance

- The economy should support multiple banking institutions.
- The initial institutions should be:
  - Heavenly Accord Bank
  - Nine Abyss Treasury
  - Golden Abacus Consortium
- Banking terms should depend on:
  - player alignment
  - clan alignment
  - institution alignment
  - credit score
  - the global economy state
- Players and clans can hold deposits, loans, and cash reserves at banks.
- Clan treasuries should be first-class wallets, not bank accounts.
- Credit score should gate loan access and loan terms.
- Credit scoring should follow real-world style factors:
  - payment history
  - amounts owed / utilization
  - length of credit history
  - new credit / recent inquiries
  - credit mix
  - delinquency and foreclosure history
- The score should influence approval, interest rate, maximum borrowable amount, and delinquency tolerance.
- The working credit bands should mirror real-world style ranges:
  - `800-850`: exceptional
  - `740-799`: very good
  - `670-739`: good
  - `580-669`: fair
  - `300-579`: poor
  - below `300`: distressed or effectively unbankable
- Banks can apply their own band modifiers on top of the shared bureau score.
- Loans should be collateralized.
- Loan terms should be compressed from real-world time so progression stays game-paced rather than life-paced.
- A five-year loan in-world should behave more like a five-month loan in game time.
- Missed payments should trigger a warning immediately and then allow a 24-hour grace period before delinquency fees begin.
- The first delinquency fee should be modest but meaningful, roughly `5%` of the missed installment or overdue balance.
- If the delinquency is still unpaid after 48 hours, the bank should issue a foreclosure warning and add another meaningful fee, roughly `10%` of the overdue amount plus the missed installment pressure from the next payment window.
- Foreclosure should require the delinquent balance, fees, and one forward payment window to remain unpaid.
- Default should allow the bank to seize the collateral or the financed asset.
- If the collateral is cultivation progress, foreclosure should reduce both raw cultivation and realm progress instead of deleting the character.
- The extraction flavor should be strong enough to feel like cultivated essence being forcibly stripped away.
- Foreclosure on cultivation collateral should typically drop the player by minor realms, but not erase major realms outright.
- A future progression rule can convert that loss into a formula based on debt burden and passive cultivation, for example `daily passive cultivation gain * D * n`, where `D` is a debt ratio and `n` is a severity multiplier.
- The bank lifecycle should be modeled as:
  - `eligible`
  - `quoted`
  - `approved`
  - `active`
  - `late`
  - `delinquent`
  - `foreclosure warning`
  - `foreclosed`
  - `closed`
- `quoted` should present payment amount, estimated term, collateral, and band-based rate.
- `late` should be the first missed-payment state.
- `delinquent` should mean the grace period has expired and fees are accruing.
- `foreclosure warning` should be the final notice before collateral seizure.
- Banks should differ in how easily they approve, how harshly they treat virtuous or demonic borrowers, and how quickly they push a loan toward the late and delinquent states.
- Alignment should influence bank behavior:
  - righteous banks are stricter and more honor-bound
  - demonic banks are predatory, socially cruel, and harsh on the virtuous
  - neutral banks are accessible but should carry enough friction, fees, or hidden costs to still matter
- This behavior is currently implemented in the banking policy layer for delinquency tolerance and foreclosure harshness, while quote-time approval bias remains separate.
- Credit score should influence:
  - interest rate
  - approval or denial
  - maximum borrowable amount
  - delinquency tolerance
- Credit history should include missed payments, debt amount, foreclosure history, and other bank-facing trust signals.
- A separate hidden credit bureau should share player credit information across banks in lore and system terms.
- Demonic banks should be especially harsh on virtuous borrowers and should treat righteousness as a liability in their in-character policies.
- Foreclosure should not delete the character; it should burn leverage and extracted cultivation, or seize the financed asset, depending on the collateral type.
- Players should be able to choose their active bank with a simple command flow.
- The active bank choice should be a player-scoped global setting.
- `/bank` should show the current active bank.
- `/bank <bank>` should set the active bank, with autocomplete over the known institutions.
- `/deposit`, `/withdraw`, and loan commands should use the active bank by default.
- Bank-selection buttons can be used as a fallback or convenience path, but the slash-command flow should stay simple.
- `/bank` should stay fast enough that players can use it as a lightweight status command, not just as a setup step.
- The banking feature should be built so the same service layer can later power a companion web UI.
- Command handlers should stay thin and delegate bank logic to reusable modules or API-like services.

## Approval Model

- Approval should use a simple bureau-first formula with bank-specific modifiers.
- The shared bureau score should be treated like a normalized FICO-style input, then adjusted by the institution.
- A practical approval formula can be:
  - `approvalScore = creditBase + paymentHistory + utilization + historyLength + newCredit + creditMix + delinquencyPenalty + bankBias + alignmentBias + collateralBoost`
- Suggested weight shape:
  - payment history: strongest positive factor
  - utilization / amounts owed: second strongest factor
  - length of credit history: moderate factor
  - new credit / recent inquiries: moderate negative factor when overused
  - credit mix: small positive factor
  - delinquency / foreclosure history: large negative factor
  - bank bias: institution-specific attitude toward the borrower
  - alignment bias: righteous, demonic, or neutral attitude from the bank
  - collateral boost: positive if the loan is well secured
- Hard blockers should override the score:
  - active foreclosure
  - unresolved delinquency past the grace window
  - collateral that does not cover the minimum required value for the requested loan
- A bank should be able to approve a smaller or higher-cost loan when the score is weak, but not if a hard blocker is present.
- The exact numeric weights can be tuned later, but the structure should remain bureau score first, then bank-specific judgment.

## Lake System

- Lakes are world resources, not a generic per-guild maintenance side effect.
- Each lake should have at least:
  - `level`
  - `size`
  - `restockRate` or `restockProgress`
  - ownership context such as public or clan-owned
- Lake `level` should influence fish value.
- Lake `size` should influence how much fish can exist in the lake.
- Restock speed should be based on the combined lake state, not on Discord server membership alone.
- Full restock cadence should eventually settle on a weekly cycle, with Sunday as the complete refill day.
- Lake level should also influence species mix, not just fish value.
- The public lake should be a special shared lake:
  - larger than the average clan lake
  - lower quality than the average clan lake
  - intended to support wanderers and the public fish economy
- The public lake should start as the only lake until more regions are added later by the game admins.
- Clan lakes should eventually be tied to clan membership, clan land, and clan resources.

## Scheduled Systems

- The scheduler now treats bank maintenance as a player-wide pass and lake restocks as public-lake work; any guild-shaped lookup that remains is a compatibility detail, not the maintenance unit.
- Future scheduling should distinguish:
  - global maintenance that affects all players
  - public-resource maintenance
  - clan-specific maintenance
- Lake restocking should eventually run as a lake-scoped tick over every public or clan lake, not as a generic per-guild job.
- Bank interest should eventually run against player accounts and banking institutions, not as a generic guild job.
- Clan standing and clan alignment should modify the banking and lake rules where appropriate.

## Combat And Travel

- Clan visits are future work.
- Unannounced clan visits and clan attacks are future work.
- Those systems should be written as an extension of the clan model, not bolted on as special cases.
- Attack and visit flows should sit on top of the clan membership model, not replace it.

## Implementation Order

1. Lock the global player model and the clan membership model.
2. Define alignment and virtue thresholds.
3. Define public vs clan resource behavior.
4. Define the shared banking service API and active-bank persistence.
5. Define banking institutions, credit scoring, and approval rules.
6. Define lake levels, size, and restock rules.
7. Rework scheduled maintenance around the new clan and resource model.
8. Add travel, visits, and hostility systems later.

## Notes On Current Code

- The current code still treats `guildId` as the operational boundary for several systems.
- That is acceptable for now, but it should be treated as transitional until clan membership and wanderer/public-resource behavior are in place.
- The scheduler work that was being discussed earlier is affected by this roadmap because “per guild” will eventually mean “per clan context,” not simply “whatever server the bot is in.”
- Bank alignment now affects delinquency tolerance and foreclosure harshness through the bank policy layer.
- Loan maintenance decision rules now live in a dedicated decision service, keeping the lifecycle orchestration thin.
- Active loan operations are contract-led now, with `player.debt` kept as a compatibility mirror for the existing economy surface.
- Loan lifecycle maintenance is now scheduled as its own maintenance job instead of being hidden inside the daily bank-interest pass.
- Lake restocks now target lake entities directly instead of treating every player-bearing guild as a lake target.
- Lake records now carry explicit ownership metadata, and current scheduled restocks only target public lakes.
- Clan service helpers now exist as a reusable boundary in `src/modules/clanService.js`, but clan membership persistence and flows are still future work.
