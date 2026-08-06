interface PageContainerProps {
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly size?: "default" | "narrow";
}

export function PageContainer({
  children,
  className = "",
  size = "default",
}: PageContainerProps) {
  return (
    <div
      className={`page-container ${size === "narrow" ? "page-container--narrow" : ""} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
