import { describe } from 'vitest';
import { InMemoryPresenceStore } from './InMemoryPresenceStore';
import { describePresenceStoreContract } from './presence-store-contract';

describe('InMemoryPresenceStore', () => {
  describePresenceStoreContract(async () => new InMemoryPresenceStore());
});
