import { Player } from './types';

export type CardAction =
  | { type: 'MONEY'; amount: number } // Positive for gain, negative for loss
  | { type: 'MOVE_TO'; position: number; collectGo?: boolean } // collectGo true means if they pass GO they get $200
  | { type: 'GO_TO_JAIL' }
  | { type: 'GET_OUT_OF_JAIL' }
  | { type: 'REPAIRS'; houseCost: number; hotelCost: number };

export interface Card {
  id: string;
  text: string;
  action: CardAction;
}

export const processCardEffect = (
  player: Player,
  card: Card
): { player: Player; sentToJail: boolean } => {
  const newPlayer = { ...player };
  let sentToJail = false;

  switch (card.action.type) {
    case 'MONEY':
      newPlayer.money += card.action.amount;
      break;

    case 'REPAIRS': {
      let houses = 0;
      let hotels = 0;

      // Iterate over all properties where the player has built something
      Object.values(newPlayer.houses).forEach((count) => {
        if (count === 5) {
          hotels += 1;
        } else {
          houses += count;
        }
      });

      const totalCost = (houses * card.action.houseCost) + (hotels * card.action.hotelCost);
      newPlayer.money -= totalCost;
      break;
    }

    case 'GO_TO_JAIL':
      newPlayer.position = 10; // Jail index
      newPlayer.isInJail = true;
      newPlayer.jailTurns = 0;
      sentToJail = true;
      break;

    case 'MOVE_TO':
      // Check if passing GO (wrapping around board)
      // If target position is less than current position, we passed GO
      // (Unless we are just moving backwards, but typical cards are advance)
      // Logic from original: if (card.action.collectGo && card.action.position < newPosition)
      if (card.action.collectGo && card.action.position < newPlayer.position) {
        newPlayer.money += 200;
      }
      newPlayer.position = card.action.position;
      break;

    case 'GET_OUT_OF_JAIL':
      newPlayer.getOutOfJailCards = (newPlayer.getOutOfJailCards || 0) + 1;
      break;
  }

  return { player: newPlayer, sentToJail };
};
