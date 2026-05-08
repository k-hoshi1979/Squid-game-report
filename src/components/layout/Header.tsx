interface HeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  leftAction?: React.ReactNode;
}

export function Header({ title, description, action, leftAction }: HeaderProps) {
  return (
    <div className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-[var(--border)] bg-[var(--card)]">
      <div className="flex items-center gap-3 min-w-0">
        {leftAction}
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-semibold text-[var(--foreground)] truncate">{title}</h1>
          {description && (
            <p className="text-xs sm:text-sm text-[var(--muted-foreground)] truncate">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0 ml-2">{action}</div>}
    </div>
  );
}
