import type { NavigationIcon } from "@/lib/routes/navigation";

interface AppIconProps {
  readonly name: NavigationIcon;
  readonly size?: number;
}

const paths: Record<NavigationIcon, React.ReactNode> = {
  account: (
    <>
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.75 19c.7-3.2 2.8-4.8 6.25-4.8s5.55 1.6 6.25 4.8" />
    </>
  ),
  home: (
    <>
      <path d="m3.5 10 8.5-7 8.5 7" />
      <path d="M5.5 9v11h13V9M9.5 20v-6h5v6" />
    </>
  ),
  notice: (
    <>
      <path d="M6.5 9a5.5 5.5 0 0 1 11 0c0 6 2.25 6 2.25 7.5H4.25C4.25 15 6.5 15 6.5 9Z" />
      <path d="M10 20h4" />
    </>
  ),
  pack: (
    <>
      <path d="M5 4.5h14l-1 15H6l-1-15Z" />
      <path d="M5.5 8h13M9 4.5V3h6v1.5M9.25 12h5.5" />
    </>
  ),
  points: (
    <>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M9.25 16V8h3.25a2.5 2.5 0 0 1 0 5H9.25M9.25 13H13" />
    </>
  ),
};

export function AppIcon({ name, size = 22 }: AppIconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7">
        {paths[name]}
      </g>
    </svg>
  );
}
