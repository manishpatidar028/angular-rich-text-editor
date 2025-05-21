// src/lib/paths.ts
import { InjectionToken } from '@angular/core';

// Default paths
export const DEFAULT_RICHTEXTEDITOR_ASSETS_PATH = 'assets/richtexteditor';

// Injection token for configuration
export const RICHTEXTEDITOR_ASSETS_PATH = new InjectionToken<string>(
  'RICHTEXTEDITOR_ASSETS_PATH',
  {
    providedIn: 'root',
    factory: () => DEFAULT_RICHTEXTEDITOR_ASSETS_PATH
  }
);