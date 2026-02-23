export interface CountryConfig {
  flag: string;
  currency: string;
  agiLabel: string;
  stateRegionLabel: string;
  stateTotalsHeader: string;
  stateTaxTotalLabel: string;
  avgAgiLabel: string;
  stateMarginalRateLabel: string;
  stateEffectiveRateLabel: string;
}

export const COUNTRY_CONFIGS: Record<string, CountryConfig> = {
  US: {
    flag: "🇺🇸",
    currency: "USD",
    agiLabel: "Adjusted gross income",
    stateRegionLabel: "State",
    stateTotalsHeader: "STATE TOTALS",
    stateTaxTotalLabel: "Total state tax",
    avgAgiLabel: "Avg. adjusted gross income",
    stateMarginalRateLabel: "State marginal",
    stateEffectiveRateLabel: "State effective",
  },
  CA: {
    flag: "🇨🇦",
    currency: "CAD",
    agiLabel: "Net income",
    stateRegionLabel: "Province",
    stateTotalsHeader: "PROVINCIAL TOTALS",
    stateTaxTotalLabel: "Total provincial tax",
    avgAgiLabel: "Avg. net income",
    stateMarginalRateLabel: "Provincial marginal",
    stateEffectiveRateLabel: "Provincial effective",
  },
};

export function getCountryConfig(country: string): CountryConfig {
  return COUNTRY_CONFIGS[country] ?? COUNTRY_CONFIGS["US"]!;
}
