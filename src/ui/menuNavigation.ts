/** Cascading disclosure menus: keep ancestor branches open and close only siblings. */
function collapse(button: HTMLElement): void {
  button.setAttribute('aria-expanded', 'false');
  const panel = button.nextElementSibling as HTMLElement | null;
  if (!panel) return;
  panel.hidden = true;
  panel.querySelectorAll<HTMLElement>('.submenu-trigger').forEach(child => child.setAttribute('aria-expanded', 'false'));
  panel.querySelectorAll<HTMLElement>('.submenu').forEach(child => child.hidden = true);
}

export function openSubmenu(button: HTMLElement, open = true): void {
  const container = button.parentElement?.parentElement;
  if (!container) return;
  // Direct siblings only: never collapse the Purchase ancestor when opening Orders.
  for (const child of container.children) {
    const sibling = child.querySelector<HTMLElement>(':scope > .submenu-trigger');
    if (sibling && sibling !== button) collapse(sibling);
  }
  if (!open) { collapse(button); return; }
  const panel = button.nextElementSibling as HTMLElement;
  button.setAttribute('aria-expanded', 'true');
  panel.hidden = false;
  panel.classList.remove('opens-left');
  panel.style.top = '';
  if (matchMedia('(min-width: 901px)').matches) {
    const rect = panel.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) panel.classList.add('opens-left');
    const bottom = panel.getBoundingClientRect().bottom;
    if (bottom > window.innerHeight - 8) panel.style.top = `${-7 - (bottom - window.innerHeight + 8)}px`;
  }
}

function directButtons(panel: Element): HTMLButtonElement[] {
  return Array.from(panel.querySelectorAll<HTMLButtonElement>(':scope > button, :scope > .submenu-wrap > button'));
}

export function handleMenuKey(event: KeyboardEvent): boolean {
  const button = (event.target as Element).closest<HTMLButtonElement>('.menu-wrap button');
  if (!button) return false;
  const root = button.classList.contains('menu-trigger');
  const panel = button.closest('.submenu, .menu');
  let handled = true;
  if (event.key === 'ArrowRight' && button.classList.contains('submenu-trigger')) {
    openSubmenu(button); directButtons(button.nextElementSibling!)[0]?.focus();
  } else if (event.key === 'ArrowDown' && root) {
    if (button.getAttribute('aria-expanded') !== 'true') button.click();
    directButtons(button.nextElementSibling!)[0]?.focus();
  } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) && panel) {
    const buttons = directButtons(panel), index = buttons.indexOf(button);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 :
      (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  } else if (['ArrowLeft', 'Escape'].includes(event.key) && panel) {
    const parent = panel.previousElementSibling as HTMLElement;
    collapse(parent); parent.focus();
  } else if (event.key === 'Escape' && root) {
    collapse(button);
  } else handled = false;
  if (handled) { event.preventDefault(); event.stopPropagation(); }
  return handled;
}

export function handleMenuHover(event: PointerEvent): void {
  if (event.pointerType !== 'mouse' || !matchMedia('(hover: hover) and (min-width: 901px)').matches) return;
  const button = (event.target as Element).closest<HTMLElement>('.menu-wrap button');
  if (!button || button.contains(event.relatedTarget as Node | null)) return;
  if (button.classList.contains('submenu-trigger')) openSubmenu(button);
  else if (button.classList.contains('menu-trigger')) {
    // Moving along the top bar switches menus only after one has been opened.
    if (document.querySelector('.menu-trigger[aria-expanded="true"]') && button.getAttribute('aria-expanded') !== 'true') button.click();
  } else {
    const panel = button.parentElement;
    panel?.querySelectorAll<HTMLElement>(':scope > .submenu-wrap > .submenu-trigger').forEach(collapse);
  }
}
