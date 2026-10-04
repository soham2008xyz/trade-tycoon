# Bankruptcy is declared by the player and settles with the creditor

A player whose balance goes below $0 is not removed automatically. They cannot end their turn until they sell, mortgage or explicitly declare bankruptcy. Because the debt can sit there across several actions, the reducer records who it is owed to at the moment it arises, in `Player.debtOwedTo`, and bankruptcy then hands the player's assets to that creditor instead of the bank.

The first version of bankruptcy removed the player without handing their assets to anyone. The audit later routed it through the same cleanup as leaving a room, so trades and auctions involving the player no longer dangle, and it left creditor transfer as an optional gameplay follow-up. That follow-up is this decision.

## Decisions

- **Only player-to-player payments create a creditor.** Rent and "collect from every player" cards record one; taxes, fines and repairs owe the bank. A bank charge never overwrites an existing creditor, a later player payment replaces it, and a $0 charge (rent on a mortgaged tile) records nothing, so it cannot make an unrelated player the creditor of someone else's debt.
- **The creditor is cleared centrally, not by each action.** One step on every reducer result drops `debtOwedTo` once the player is solvent again or the creditor has left, so new money-moving actions need no debt code. The key is deleted rather than set to `undefined`, so a state is identical after a round trip through Redis. A debt cleared earlier in the same roll, such as by GO income, must be settled before a later tax or card charge is applied, or assets could go to a stale creditor.
- **What the creditor receives.** Properties arrive with their mortgage flag intact and with no transfer fee, along with any Get Out of Jail Free cards. Buildings are sold to the bank at half price and that cash goes to the creditor, so properties arrive bare.
- **Declaring while solvent, over a bank debt, or after the creditor has left forfeits everything to the bank.** Leaving a room mid-game never transfers assets to anyone.

## Considered options

- **Charging the unpaid shortfall to the creditor.** Rejected: rent is credited to the owner in full when it is charged, even if the payer is short, so clawing the rest back would be a surprising second penalty. The shortfall is written off.
