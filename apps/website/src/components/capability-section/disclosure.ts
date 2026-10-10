const PAGE_SIZE = 4;
let pageController: AbortController | undefined;

/** Enhances the single static catalog only after each section's controls are available. */
const initializeDisclosure = (): void => {
  pageController?.abort();
  const controller = new AbortController();
  pageController = controller;
  const fragments = new Map<string, () => HTMLElement>();

  for (const section of document.querySelectorAll<HTMLElement>('[data-capability-section]')) {
    const list = section.querySelector<HTMLElement>('[data-capability-list]');
    const controls = section.querySelector<HTMLElement>('[data-capability-controls]');
    const button = section.querySelector<HTMLButtonElement>('[data-capability-load]');
    const count = section.querySelector<HTMLElement>('[data-capability-count]');
    if (!list || !controls || !button || !count) continue;
    const examples = Array.from(
      list.querySelectorAll<HTMLElement>(':scope > [data-capability-example]'),
    );
    let visible = Math.min(PAGE_SIZE, examples.length);
    for (const [index, example] of examples.entries()) example.hidden = index >= visible;

    const updateControls = (): void => {
      count.textContent = `${visible} of ${examples.length} examples`;
      button.hidden = visible === examples.length;
    };
    const reveal = (next: number): void => {
      for (let index = visible; index < next; index++) examples[index].hidden = false;
      visible = next;
      updateControls();
    };
    updateControls();
    controls.hidden = false;
    button.addEventListener(
      'click',
      (event) => {
        const first = examples[visible];
        if (!first) return;
        const previousTop = button.getBoundingClientRect().top;
        reveal(Math.min(visible + PAGE_SIZE, examples.length));
        const trigger = first.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]');
        if (event.detail === 0) {
          trigger?.focus({ preventScroll: true });
          trigger?.scrollIntoView({ block: 'nearest' });
        } else {
          // put new content where the activated control was, including scroll anchoring adjustments
          window.scrollBy(0, first.getBoundingClientRect().top - previousTop);
          if (button.hidden) trigger?.focus({ preventScroll: true });
        }
      },
      { signal: controller.signal },
    );

    for (const [index, example] of examples.entries()) {
      fragments.set(example.id, () => {
        if (index >= visible)
          reveal(Math.min(examples.length, Math.ceil((index + 1) / PAGE_SIZE) * PAGE_SIZE));
        return example;
      });
    }
  }

  const revealFragment = (): void => {
    let id: string;
    try {
      id = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return;
    }
    const reveal = fragments.get(id);
    if (!reveal) return;
    const target = reveal();
    requestAnimationFrame(() => {
      if (controller.signal.aborted || !target.isConnected) return;
      target.scrollIntoView({ block: 'start' });
      const dialog = document.getElementById(`example-${id}`);
      if (!(dialog instanceof HTMLDialogElement) || dialog.open) return;
      for (const openDialog of Array.from(
        document.querySelectorAll<HTMLDialogElement>('[data-capability-example] dialog:modal'),
      ).reverse())
        openDialog.close();
      target.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')?.click();
    });
  };
  window.addEventListener('hashchange', revealFragment, { signal: controller.signal });
  window.addEventListener('popstate', revealFragment, { signal: controller.signal });
  revealFragment();
};

initializeDisclosure();
document.addEventListener('astro:page-load', initializeDisclosure);
document.addEventListener('astro:before-swap', () => pageController?.abort());
