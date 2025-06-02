import { AbstractControl } from '@angular/forms';

export function hasRequiredValidator(control: AbstractControl | null): boolean {
  if (!control || !control.validator) return false;
  const result = control.validator({ value: null } as AbstractControl);
  return !!(result && result['required']);
}

/**
 * Enhanced empty check that considers images and media as content
 */
export function isTrulyEmpty(html: string): boolean {
  if (!html || html.trim() === '') return true;

  const div = document.createElement('div');
  div.innerHTML = html;

  const hasImages = div.querySelectorAll('img').length > 0;
  if (hasImages) return false;

  const hasVideos = div.querySelectorAll('video, iframe').length > 0;
  if (hasVideos) return false;

  const hasEmbeds = div.querySelectorAll('embed, object, audio').length > 0;
  if (hasEmbeds) return false;

  const text = div.textContent?.replace(/\u00A0/g, '').trim() || '';

  const cleaned = div.innerHTML
    .replace(/<br\s*\/?>/gi, '')
    .replace(/<div>(\s|&nbsp;)*<\/div>/gi, '')
    .replace(/<p>(\s|&nbsp;)*<\/p>/gi, '')
    .replace(/&nbsp;/gi, '')
    .trim();

  return !text && cleaned.length === 0;
}
