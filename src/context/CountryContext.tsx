import { createContext, useContext, useMemo } from "react";

import { COUNTRY_CONFIGS, type CountryConfig, getCountryConfig } from "../lib/countryConfig";

const CountryContext = createContext<CountryConfig>(COUNTRY_CONFIGS["US"]!);

export function CountryConfigProvider({
  country,
  children,
}: {
  country: string;
  children: React.ReactNode;
}) {
  const config = useMemo(() => getCountryConfig(country), [country]);
  return <CountryContext.Provider value={config}>{children}</CountryContext.Provider>;
}

export function useCountryConfig(): CountryConfig {
  return useContext(CountryContext);
}
