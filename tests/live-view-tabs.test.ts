import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveViewLabels, enabledLiveViews, nextLiveView, liveViewTabs, bindLiveViewTabs, focusLiveControl, liveSessionNotice } from '../src/ui/liveViewTabs.ts';
import type { LiveView } from '../src/integration/readOnlyWorkspace.ts';
const owner = { canReadInvoices: true, canReadPurchasing: true }, staff = { canReadInvoices: false, canReadPurchasing: false };
test('tab markup has one keyboard entry, named tabs and valid selected panel relationship', () => {
    const html = liveViewTabs('supplierReturns', owner);
    assert.equal((html.match(/tabindex="0"/g) || []).length, 1);
    assert.equal((html.match(/aria-selected="true"/g) || []).length, 1);
    assert.ok(html.includes('id="live-tab-supplierReturns" aria-controls="live-view-panel" aria-selected="true" tabindex="0"'));
    assert.equal((html.match(/role="tab"/g) || []).length, Object.keys(liveViewLabels).length);
    assert.ok(html.includes('aria-describedby="live-tab-help"'));
    assert.ok(html.includes('Selecting a view does not load records'));
    const busy = liveViewTabs('products', owner, true);
    assert.equal(busy.includes('tabindex="0"'), false);
    assert.equal((busy.match(/ disabled/g) || []).length, Object.keys(liveViewLabels).length);
});
test('keyboard wraps, handles Home/End, skips restricted views and leaves unrelated keys alone', () => {
    const accessible = enabledLiveViews(staff);
    assert.deepEqual(accessible, ['products', 'categories', 'inventory']);
    assert.equal(nextLiveView('products', 'ArrowRight', accessible), 'categories');
    assert.equal(nextLiveView('products', 'ArrowLeft', accessible), 'inventory');
    assert.equal(nextLiveView('inventory', 'ArrowRight', accessible), 'products');
    assert.equal(nextLiveView('inventory', 'Home', accessible), 'products');
    assert.equal(nextLiveView('products', 'End', accessible), 'inventory');
    assert.equal(nextLiveView('products', 'Tab', accessible), null);
    assert.equal(nextLiveView('invoices', 'ArrowRight', accessible), null);
    assert.equal(nextLiveView('products', 'Home', []), null);
    assert.equal(nextLiveView('products', 'End', enabledLiveViews(owner)), 'rateDifferences');
    const html = liveViewTabs('products', staff);
    assert.ok(html.includes('data-live-view="invoices" disabled'));
});
class FakeButton extends EventTarget {
    disabled = false;
    dataset: {
        liveView: LiveView;
    };
    constructor(view: LiveView, disabled = false) { super(); this.dataset = { liveView: view }; this.disabled = disabled; }
}
function key(button: FakeButton, value: string, modifier = false) {
    const event = Object.assign(new Event('keydown', { cancelable: true }), { key: value, ctrlKey: modifier, altKey: false, metaKey: false, shiftKey: false });
    button.dispatchEvent(event);
    return event;
}
test('actual tab binding handles keyboard/click without activating disabled tabs or intercepting shortcuts', () => {
    const tabs = [new FakeButton('products'), new FakeButton('inventory'), new FakeButton('invoices', true)];
    const root = { querySelectorAll: () => tabs } as unknown as ParentNode;
    const selections: LiveView[] = [];
    bindLiveViewTabs(root, value => selections.push(value));
    assert.equal(key(tabs[0], 'ArrowRight').defaultPrevented, true);
    assert.deepEqual(selections, ['inventory']);
    assert.equal(key(tabs[1], 'ArrowRight').defaultPrevented, true);
    assert.deepEqual(selections, ['inventory', 'products']);
    assert.equal(key(tabs[0], 'ArrowRight', true).defaultPrevented, false);
    assert.equal(key(tabs[0], 'Tab').defaultPrevented, false);
    key(tabs[2], 'Home');
    tabs[2].dispatchEvent(new Event('click'));
    assert.equal(selections.length, 2);
    tabs[0].dispatchEvent(new Event('click'));
    assert.equal(selections.at(-1), 'products');
});
test('focus restoration tolerates missing/disabled controls and reveals focused tabs only', () => {
    const actions: string[] = [];
    let disabled = false, tab = true;
    const element = { matches: () => disabled, focus: () => actions.push('focus'), getAttribute: () => tab ? 'tab' : null, scrollIntoView: () => actions.push('scroll') };
    focusLiveControl({ querySelector: () => null } as unknown as ParentNode, 'missing');
    const root = { querySelector: () => element } as unknown as ParentNode;
    focusLiveControl(root, 'live-tab-products');
    assert.deepEqual(actions, ['focus', 'scroll']);
    disabled = true;
    focusLiveControl(root, 'live-load');
    assert.equal(actions.length, 2);
    disabled = false;
    tab = false;
    focusLiveControl(root, 'live-results');
    assert.deepEqual(actions, ['focus', 'scroll', 'focus']);
});
test('session notice exposes a readable expiry without token, countdown polling or extending the session', () => {
    const expiry = Date.parse('2026-11-03T15:15:00Z');
    const html = liveSessionNotice(expiry);
    assert.ok(html.includes('datetime="2026-11-03T15:15:00.000Z"'));
    assert.ok(html.includes('Reloading signs you out'));
    assert.ok(html.includes('keeps this session open'));
    assert.equal(/<script|<input|<button/.test(html), false);
    assert.equal(liveSessionNotice(NaN), '');
});
