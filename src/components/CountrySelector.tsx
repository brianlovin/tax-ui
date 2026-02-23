import { COUNTRY_CONFIGS } from "../lib/countryConfig";
import { Menu, MenuItem } from "./Menu";

interface Props {
  country: string;
  onChange: (country: string) => void;
}

export function CountrySelector({ country, onChange }: Props) {
  const flag = COUNTRY_CONFIGS[country]?.flag;

  return (
    <Menu
      trigger={
        <span className="flex items-center gap-1">
          {flag && <span>{flag}</span>}
          <span className="font-mono text-xs">{country}</span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-60"
          >
            <path d="M2 3.5L5 6.5L8 3.5" />
          </svg>
        </span>
      }
      triggerClassName="shrink-0"
      side="bottom"
      align="end"
      sideOffset={4}
    >
      {Object.entries(COUNTRY_CONFIGS).map(([c, config]) => (
        <MenuItem key={c} onClick={() => onChange(c)} selected={c === country}>
          <span>{config.flag}</span>
          <span className="font-mono text-xs">{c}</span>
        </MenuItem>
      ))}
    </Menu>
  );
}
