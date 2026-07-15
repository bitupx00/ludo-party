/**
 * Inject a component's static CSS into <head> exactly ONCE per module.
 *
 * The components used to carry a <style>{`...`}</style> tag inside their
 * JSX: every instance duplicated the whole stylesheet in the DOM (4
 * avatar badges = 4 copies) and every re-render re-allocated a multi-KB
 * template string — measurable churn on the game screen, which re-renders
 * on each store change. Module-scope injection costs zero per render.
 */
const injected = new Set<string>();

export function styleOnce(id: string, css: string): void {
  if (injected.has(id) || typeof document === 'undefined') return;
  injected.add(id);
  const el = document.createElement('style');
  el.dataset.styleFor = id;
  el.textContent = css;
  document.head.appendChild(el);
}
