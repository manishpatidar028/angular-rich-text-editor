export function safely(fn: () => void): void {
  try {
    fn();
  } catch {
    // Swallow the error silently
  }
}
