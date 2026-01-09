# Monopoly Game Specification

This document tracks the implementation status of features for the Trade Tycoon project, adhering to standard Monopoly rules.

## Legend

- [x] Implemented & Tested
- [ ] Not Implemented
- [~] Partial Implementation / MVP Limitation

## 1. Game Setup

- [x] **Player Registration**: Support for 2-8 players with custom names (via GameSetup modal).
- [x] **Token Selection**: Players can select distinct colors/tokens.
- [x] **Starting Balance**: Each player starts with $1500.
- [~] **Turn Order**: Sequential based on registration order (Randomization not implemented).

## 2. Board & Tokens

- [x] **Standard Board**: 40 distinct spaces (Properties, Railroads, Utilities, Corners, Taxes, Special).
- [x] **Property Groups**: Properties are grouped by color sets.
- [x] **Visuals**: Board rendering with player token positions.

## 3. Gameplay Mechanics

- [x] **Dice Rolling**: 2d6 generation.
- [x] **Token Movement**: Advance token by dice sum.
- [x] **Doubles**:
  - [x] Roll again on doubles.
  - [x] 3 consecutive doubles sends player to Jail.
- [x] **Passing GO**: Collect $200 salary.
- [x] **Turn Management**: Enforce phases (Roll -> Action -> End).

## 4. Property Management

- [x] **Buying**: Buy unowned properties at listed price.
- [ ] **Auctions**: Auction unowned properties if declined by landing player.
- [~] **Rent**:
  - [x] Pay rent to owner upon landing.
  - [ ] Double rent for complete color sets (unimproved).
  - [~] Railroad/Utility rent calculation logic (MVP uses base rent).
- [ ] **Building**:
  - [ ] Build Houses (up to 4) on complete color sets.
  - [ ] Build Hotels (after 4 houses).
- [ ] **Mortgages**:
  - [ ] **Action**: Mortgage owned property for 50% of its value during player's turn.
  - [ ] **Restriction**: Cannot mortgage if buildings exist on the property (must sell buildings first).
  - [ ] **Effect**: No rent can be collected on mortgaged properties.
  - [ ] **Visuals**: Mortgaged properties appear visually distinct (e.g., grayed out or flipped).
  - [ ] **Unmortgage**: Lift mortgage by paying mortgage value + 10% interest.
- [ ] **Trading**:
  - [ ] **Offer**: Initiate trade with another player during turn.
  - [ ] **Content**: Trade combination of Cash and Properties.
  - [ ] **Flow**:
    - Propose trade -> Counter-party reviews -> Accept/Decline.
  - [ ] **Validation**: Ensure trade is valid (assets owned, sufficient funds).

## 5. Special Spaces & Cards

- [x] **Chance Cards**: Implement standard deck effects (Movement, Money, Jail, etc.).
- [x] **Community Chest**: Implement standard deck effects.
- [x] **Taxes**:
  - [x] Income Tax (Flat price).
  - [x] Luxury Tax (Flat price).
- [x] **Free Parking**: No action (Standard rules).
- [x] **Jail**:
  - [x] Go to Jail (Landing on space, Card, 3 Doubles).
  - [x] **Getting Out**:
    - [x] Roll doubles (3 attempts).
    - [x] Pay $50 fine.
    - [x] Use "Get Out of Jail Free" card.
  - [x] Force fine payment after 3 failed roll attempts.

## 6. End Game

- [~] **Bankruptcy**:
  - [~] Handle insufficient funds (Money goes negative, logic incomplete).
  - [ ] Transfer assets to creditor or bank.
- [ ] **Winner Declaration**: Last player remaining wins.
