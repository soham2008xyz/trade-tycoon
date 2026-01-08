export type CommunityChestAction =
    | { type: 'MONEY', amount: number } // Positive for gain, negative for loss
    | { type: 'MOVE_TO', position: number, collectGo?: boolean } // collectGo true means if they pass GO they get $200
    | { type: 'GO_TO_JAIL' }
    | { type: 'GET_OUT_OF_JAIL' };

export interface CommunityChestCard {
    id: string;
    text: string;
    action: CommunityChestAction;
}

export const COMMUNITY_CHEST_CARDS: CommunityChestCard[] = [
    { id: 'cc1', text: "Advance to Go (Collect $200)", action: { type: 'MOVE_TO', position: 0, collectGo: true } },
    { id: 'cc2', text: "Bank error in your favor. Collect $200", action: { type: 'MONEY', amount: 200 } },
    { id: 'cc3', text: "Doctor's fees. Pay $50", action: { type: 'MONEY', amount: -50 } },
    { id: 'cc4', text: "From sale of stock you get $50", action: { type: 'MONEY', amount: 50 } },
    { id: 'cc5', text: "Get Out of Jail Free", action: { type: 'GET_OUT_OF_JAIL' } },
    { id: 'cc6', text: "Go to Jail. Go directly to jail, do not pass Go, do not collect $200", action: { type: 'GO_TO_JAIL' } },
    { id: 'cc7', text: "Grand Opera Night. Collect $50 from every player for opening night seats", action: { type: 'MONEY', amount: 50 } }, // Simplified to just getting $50 for MVP
    { id: 'cc8', text: "Holiday Fund matures. Receive $100", action: { type: 'MONEY', amount: 100 } },
    { id: 'cc9', text: "Income tax refund. Collect $20", action: { type: 'MONEY', amount: 20 } },
    { id: 'cc10', text: "It is your birthday. Collect $10", action: { type: 'MONEY', amount: 10 } },
    { id: 'cc11', text: "Life insurance matures. Collect $100", action: { type: 'MONEY', amount: 100 } },
    { id: 'cc12', text: "Pay hospital fees of $100", action: { type: 'MONEY', amount: -100 } },
    { id: 'cc13', text: "Pay school fees of $50", action: { type: 'MONEY', amount: -50 } },
    { id: 'cc14', text: "Receive $25 consultancy fee", action: { type: 'MONEY', amount: 25 } },
    { id: 'cc15', text: "You are assessed for street repairs. Pay $40 per house and $115 per hotel", action: { type: 'MONEY', amount: -40 } }, // Simplified to fixed amount for MVP
    { id: 'cc16', text: "You have won second prize in a beauty contest. Collect $10", action: { type: 'MONEY', amount: 10 } },
];
