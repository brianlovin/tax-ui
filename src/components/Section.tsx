export function Separator() {
  return <div className="my-2 h-px bg-(--color-border)" />;
}

export function DoubleSeparator() {
  return (
    <div className="my-2 flex flex-col gap-0.5">
      <div className="h-px bg-(--color-border)" />
      <div className="h-px bg-(--color-border)" />
    </div>
  );
}

interface SectionHeaderProps {
  children: React.ReactNode;
}

export function SectionHeader({ children }: SectionHeaderProps) {
  return <h2 className="mt-6 mb-2 text-xs text-(--color-text-muted)">{children}</h2>;
}
