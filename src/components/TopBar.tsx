import { NotificationBell } from "./NotificationBell";

export function TopBar({ title }: { title: string }) {
  return (
    <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="container-mobile flex h-12 items-center justify-between">
        <h1 className="text-base font-bold">{title}</h1>
        <NotificationBell />
      </div>
    </div>
  );
}
