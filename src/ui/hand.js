import { cardEl } from './cards.js';

/**
 * Renders the human hand with multi-select. Overlap is computed so 14 cards fit the
 * width. Cards are keyboard accessible (Enter / Space) and expose aria-pressed.
 */
export function renderHand(container, hand, { selected, legalIds, hints, onToggle, dealing = false }) {
  container.replaceChildren();
  const n = hand.length;
  const w = parseFloat(getComputedStyle(container).getPropertyValue('--w')) || parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--w')) || 46;
  const avail = container.clientWidth - 8 || 330;
  const step = n > 1 ? Math.min(w * 0.72, (avail - w) / (n - 1)) : 0;
  hand.forEach((card, i) => {
    const isSel = selected.has(card.id);
    const el = cardEl(card, (isSel ? 'sel ' : '') + (hints && legalIds && !legalIds.has(card.id) ? 'dim ' : '') + (dealing ? 'deal ' : ''));
    if (dealing) el.style.setProperty('--i', i);
    if (i > 0) el.style.marginLeft = (step - w) + 'px';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-pressed', String(isSel));
    el.addEventListener('click', () => onToggle(card.id));
    el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onToggle(card.id); } });
    container.appendChild(el);
  });
}
