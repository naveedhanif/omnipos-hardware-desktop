import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeCsv, parseProductCsv } from '../src/services/demoCsv.ts';
test('CSV quotes text, neutralizes formulas and supports quoted product names', () => { assert.equal(safeCsv([['=HYPERLINK("x")', '@command', -1]]), '"\'=HYPERLINK(""x"")","\'@command","-1"'); assert.equal(parseProductCsv('sku,name,cost_price,sell_price,uom\r\nSKU,"Paint, white",1.125,2.5,tin')[0].name, 'Paint, white'); });
test('CSV rejects malformed quoting, unsupported precision and oversized input', () => { for (const text of ['sku,name,cost_price,sell_price,uom\nA,"Bad,1,2,pcs', 'sku,name,cost_price,sell_price,uom\nA,Name,1.0001,2,pcs', 'x'.repeat(500001)])
    assert.throws(() => parseProductCsv(text)); });
