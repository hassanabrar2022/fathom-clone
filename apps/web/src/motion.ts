/**
 * Smooth scrolling is motion, so it follows the same preference as the
 * animations in theme.css rather than ignoring it, which these call sites did.
 *
 * It has a second effect worth knowing about: an element that is still gliding
 * is a moving target, and a click aimed at it can land where it used to be. That
 * is what made the moments specs fail about one run in five in Firefox.
 */
export function scrollBehavior(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'auto'
    : 'smooth';
}
