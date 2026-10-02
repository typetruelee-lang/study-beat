import type { ReactNode } from 'react';
import { TDSMobileAITProvider } from '@toss/tds-mobile-ait';
import { IS_WEB_SKIN } from './skin';

/** Toss build: TDS (required for non-game WebView mini-apps). Web build: plain (no TDS in the bundle). */
export function DesignProvider({ children }: { children: ReactNode }) {
  if (IS_WEB_SKIN) return <>{children}</>;
  return <TDSMobileAITProvider brandPrimaryColor={BRAND_PRIMARY}>{children}</TDSMobileAITProvider>;
}

/** Same as --primary in tokens.css and brand.primaryColor in apps-in-toss.config.ts. */
export const BRAND_PRIMARY = '#E2683F';
