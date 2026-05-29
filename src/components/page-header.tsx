type PageHeaderProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <h2 className="text-3xl font-bold tracking-normal">{title}</h2>
        {description ? <p className="mt-2 max-w-3xl text-[color:var(--muted-foreground)]">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}
