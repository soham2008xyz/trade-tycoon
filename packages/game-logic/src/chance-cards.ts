import { Card } from './cards';

// Re-export specific type alias if needed for backward compatibility or clarity,
// but internally we use the shared Card interface.
export type ChanceCard = Card;

export const CHANCE_CARDS: ChanceCard[] = [
  {
    id: 'c1',
    text: 'Advance to Go (Collect $200)',
    action: { type: 'MOVE_TO', position: 0, collectGo: true },
  },
  {
    id: 'c2',
    text: 'Bank error in your favor. Collect $200',
    action: { type: 'MONEY', amount: 200 },
  },
  { id: 'c3', text: "Doctor's fees. Pay $50", action: { type: 'MONEY', amount: -50 } },
  {
    id: 'c4',
    text: 'Go to Jail. Go directly to Jail, do not pass Go, do not collect $200',
    action: { type: 'GO_TO_JAIL' },
  },
  {
    id: 'c5',
    text: 'Take a trip to Reading Railroad. If you pass Go, collect $200',
    action: { type: 'MOVE_TO', position: 5, collectGo: true },
  },
  {
    id: 'c6',
    text: 'Your building loan matures. Collect $150',
    action: { type: 'MONEY', amount: 150 },
  },
  { id: 'c7', text: 'Pay poor tax of $15', action: { type: 'MONEY', amount: -15 } },
  { id: 'c8', text: 'Advance to Boardwalk', action: { type: 'MOVE_TO', position: 39 } },
  { id: 'c9', text: 'Get Out of Jail Free', action: { type: 'GET_OUT_OF_JAIL' } },
];
