import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <h1 className="num text-6xl text-primary">404</h1>
        <p className="mt-2 text-muted-foreground">페이지를 찾을 수 없어요</p>
      </div>
    </div>
  );
}

function ErrorComponent({ error }: { error: Error }) {
  console.error(error);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <h1 className="text-lg font-semibold">문제가 발생했어요</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" },
      { name: "theme-color", content: "#0A0A0A" },
      { title: "비스트렝스 운동선수 스트렝스 개인화 루틴앱" },
      { name: "description", content: "운동선수를 위한 개인화 스트렝스 루틴" },
      { property: "og:title", content: "비스트렝스 운동선수 스트렝스 개인화 루틴앱" },
      { name: "twitter:title", content: "비스트렝스 운동선수 스트렝스 개인화 루틴앱" },
      { property: "og:description", content: "운동선수를 위한 개인화 스트렝스 루틴" },
      { name: "twitter:description", content: "운동선수를 위한 개인화 스트렝스 루틴" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/85184063-7037-47b7-939d-b8452535642a/id-preview-d2d8063b--358ffe43-2bc4-4f95-a637-b1c4cf1e2cc2.lovable.app-1779893489894.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/85184063-7037-47b7-939d-b8452535642a/id-preview-d2d8063b--358ffe43-2bc4-4f95-a637-b1c4cf1e2cc2.lovable.app-1779893489894.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster theme="dark" position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
