export function safeCleanupFloatingPanels(): void {
  try {
    const selectors = [
      'rte-floatpanel',
      '.rte-floatpanel',
      '.rte-floatpanel-paragraphop',
      '[class*="rte-float"]',
      '[class*="rte-popup"]',
      '.rte-toolbar-float',
      '.rte-dropdown-panel',
    ];

    selectors.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((element) => {
        try {
          if (
            element &&
            element.parentNode &&
            document.body.contains(element)
          ) {
            element.parentNode.removeChild(element);
          }
        } catch (e) {
          if (element instanceof HTMLElement) {
            element.style.display = 'none';
            element.style.visibility = 'hidden';
          }
        }
      });
    });

    cleanupOrphanedElements();
  } catch (error) {
    // Silent fail
  }
}

export function cleanupOrphanedElements(): void {
  try {
    const rteElements = document.querySelectorAll(
      '[id*="rte_"], [class*="rte_"]'
    );

    rteElements.forEach((element) => {
      try {
        if (!document.body.contains(element)) {
          element.remove();
        }
      } catch (e) {
        // Ignore
      }
    });
  } catch (e) {
    // Silent fail
  }
}

/**
 * Monkey patch Node.prototype.removeChild to avoid NotFoundError
 * when removing already-detached DOM elements.
 */
export function patchRemoveChildIfDetached(): void {
  const originalRemoveChild = Node.prototype.removeChild;

  Node.prototype.removeChild = function (this: Node, child: Node): Node {
    if (child && child.parentNode === this) {
      return originalRemoveChild.call(this, child);
    }
    return child;
  } as typeof Node.prototype.removeChild;
}
