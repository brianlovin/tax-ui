interface Props {
  year?: number;
}

export function InvestmentsView({ year }: Props) {
  return (
    <div className="flex flex-1 items-center justify-center text-(--color-text-muted)">
      <div className="text-center">
        <p className="text-sm">{year ? `Investments for ${year}` : "Investments overview"}</p>
        <p className="mt-2 text-xs">Coming soon</p>
      </div>
    </div>
  );
}
