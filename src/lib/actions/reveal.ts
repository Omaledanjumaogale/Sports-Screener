// Scroll-reveal action — IntersectionObserver-driven fade/slide-up with
// optional child staggering. Touch-scroll safe (IO fires on any scroll
// source) and fully disabled under prefers-reduced-motion.
//
// Usage:
//   <section use:reveal>…</section>
//   <div use:reveal={{ stagger: 60 }}>  // staggers direct children
//   <div use:reveal={{ delay: 120, y: 20 }}>

export interface RevealOptions {
  /** Stagger direct children by this many ms instead of animating the node itself. */
  stagger?: number;
  /** Delay before this node reveals (ms). */
  delay?: number;
  /** Vertical offset in px (default 14). */
  y?: number;
  /** IntersectionObserver rootMargin (default '0px 0px -8% 0px'). */
  rootMargin?: string;
  /** Re-trigger when scrolled back out (default false — reveal once). */
  repeat?: boolean;
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

export function reveal(node: HTMLElement, options: RevealOptions = {}) {
  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
    return {};
  }
  if (window.matchMedia(REDUCED_MOTION).matches) {
    return {};
  }

  const {
    stagger = 0,
    delay = 0,
    y = 14,
    rootMargin = '0px 0px -8% 0px',
    repeat = false
  } = options;

  // Parent containers only stagger children; the node itself stays static.
  if (stagger > 0) {
    const kids = Array.from(node.children) as HTMLElement[];
    for (const kid of kids) {
      kid.style.opacity = '0';
      kid.style.transform = `translateY(${y}px)`;
      kid.style.willChange = 'opacity, transform';
    }
  }

  let io: IntersectionObserver | null = null;
  let revealed = false;

  const applySelf = () => {
    node.style.opacity = '0';
    node.style.transform = `translateY(${y}px)`;
    node.style.willChange = 'opacity, transform';
  };

  if (stagger <= 0) applySelf();

  const fire = () => {
    if (stagger > 0) {
      const kids = Array.from(node.children) as HTMLElement[];
      kids.forEach((kid, i) => {
        kid.style.transition = `opacity 480ms cubic-bezier(0.22, 1, 0.36, 1) ${delay + i * stagger}ms, transform 480ms cubic-bezier(0.22, 1, 0.36, 1) ${delay + i * stagger}ms`;
        kid.style.opacity = '1';
        kid.style.transform = 'translateY(0)';
      });
    } else {
      node.style.transition = `opacity 480ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, transform 480ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`;
      node.style.opacity = '1';
      node.style.transform = 'translateY(0)';
    }
  };

  const reset = () => {
    if (stagger > 0) {
      for (const kid of Array.from(node.children) as HTMLElement[]) {
        kid.style.opacity = '0';
        kid.style.transform = `translateY(${y}px)`;
      }
    } else {
      applySelf();
    }
  };

  io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && (!revealed || repeat)) {
          revealed = true;
          fire();
          if (!repeat && io) {
            io.disconnect();
            io = null;
          }
        } else if (!entry.isIntersecting && repeat && revealed) {
          reset();
          revealed = false;
        }
      }
    },
    { threshold: 0.12, rootMargin }
  );

  io.observe(node);

  return {
    destroy() {
      io?.disconnect();
      io = null;
    }
  };
}
