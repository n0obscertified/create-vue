import enUS from "./en-US.json" with { type: "json" };
import zhHans from "./zh-Hans.json" with { type: "json" };
import trTR from "./tr-TR.json" with { type: "json" };
import frFR from "./fr-FR.json" with { type: "json" };
import zhHant from "./zh-Hant.json" with { type: "json" };
// ... other imports

export const locales = {
  "en-US": enUS,
  "zh-Hans": zhHans,
  "tr-TR": trTR,
  "fr-FR": frFR,
  "zh-Hant": zhHant,
  // ... etc
} as const;

export type LocaleKey = keyof typeof locales;