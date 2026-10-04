# Trade Tycoon

A Monopoly-style property trading game for 2–8 players, played either on one shared device (hotseat) or online in a room.

## Board and property

**Tile**:
One of the 40 positions on the board, numbered in order from Go.
_Avoid_: Space, square, cell

**Property**:
A tile that a player can own: a Street, a Railroad or a Utility.

**Street**:
A property that belongs to a colored Property group and can have buildings.

**Railroad**:
A property that cannot have buildings; its rent grows with how many Railroads the owner holds.

**Utility**:
A property that cannot have buildings; its rent is a multiple of the dice roll that landed the player there.

**Property group**:
The set of properties that share a color (or, for Railroads and Utilities, a kind).

**Color set**:
A complete Property group owned by a single player; it doubles unimproved rent and allows building.
_Avoid_: Monopoly

**House**:
A building placed on a Street in a Color set, up to four per Street.

**Hotel**:
The fifth building level on a Street, replacing its four houses.

**Mortgage**:
A loan from the Bank against a property that suspends its rent until the player lifts it by repaying with interest.

**Rent**:
What a player owes the owner when landing on an owned, unmortgaged property.

**Go**:
The starting tile; passing it pays the player a salary.

**Chance**, **Community Chest**:
The two card decks, each drawn from when a player lands on the matching tile.

**Get Out of Jail Free card**:
A card, one per deck, that a player can hold, trade or use to leave Jail; using it returns it to its deck.

**Bank**:
The party that sells unowned properties and collects taxes, fines and repair charges.

## Turns

**Player**:
A participant in a game, identified by a name, a Player color and a public player id.

**Player color**:
The color that identifies a player and their piece; no two players in a game share one.
_Avoid_: Token, piece (a "token" is always a Session token)

**Turn**:
One player's go: roll, act, then end.

**Current player**:
The player whose Turn it is.

**Phase**:
Where the game is within a Turn: roll, action, auction or end.

**Doubles**:
A roll where both dice match; the player rolls again, and three in a row sends them to Jail.

**Jail**:
Where a player who rolls three Doubles in a row, lands on Go To Jail or draws a jail card is held until they leave.

**Fine**:
The payment a player can make to leave Jail instead of rolling Doubles.

## Auctions and trades

**Auction**:
A sale of an unowned property to the highest bidder, held when the landing player declines to buy it or ends their Turn without buying.

**Bid**:
An offer of money for the property being auctioned; participants take turns bidding or conceding.

**Trade**:
A proposal between two players to exchange money, properties and Get Out of Jail Free cards; it stays pending until the target accepts or rejects it or the initiator cancels it.

**Initiator**:
The player who proposes a Trade.

**Target**:
The player a Trade is proposed to; the only one who can accept or reject it.

## Debt and ending

**Creditor**:
The player a negative balance is owed to after a player-to-player payment such as rent; a debt to the Bank has no creditor.

**Bankruptcy**:
A player's explicit declaration that they cannot meet a debt, removing them from the game and handing their assets to their Creditor or, when there is none, to the Bank.

**Winner**:
The last player remaining once everyone else is bankrupt.

## Playing modes

**Hotseat**:
A game on a single device that players pass between them.

**Online game**:
A game where each player uses their own device, connected through a Room.

**Room**:
An online meeting place identified by a room ID, which holds a Lobby and then the game itself.

**Lobby**:
The part of a Room before the game starts, where players appear with their name, color and ready status.

**Host**:
The player who created the Room; the only one who can start the game.

**Ready**:
A Lobby player's signal that they are prepared to start.

**Session token**:
The private credential issued when a player creates or joins a Room; it proves who they are, unlike the public player id, which anyone may see.
_Avoid_: Token (alone), password

**Disconnected player**:
A player in a running online game whom the server has not heard from for 45 seconds; the Host (or anyone, once the Host is also disconnected) may remove them.
_Avoid_: Offline, AFK, kicked

**Resume**:
Rejoining a Room using a stored session after a refresh or restart.

**Game log**:
The chronological record of significant events in a game.
