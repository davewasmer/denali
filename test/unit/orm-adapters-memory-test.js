import test from 'ava';
import { MemoryAdapter } from '../../lib/data/orm-adapters/memory';

test.failing('MemoryAdapter > returns true after deleting an attribute', async (t) => {
  t.plan(1);

  let model = {
    record: {
      name: 'test'
    }
  };

  t.true(MemoryAdapter.deleteAttribute(model, 'name'));
});
