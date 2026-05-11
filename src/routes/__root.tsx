import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { UpgradeGateProvider } from "@/hooks/useUpgradeGate";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Keystone" },
      { name: "description", content: "Built for first time home buyers looking for a plan - not just another savings account" },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Keystone" },
      { property: "og:description", content: "Built for first time home buyers looking for a plan - not just another savings account" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Keystone" },
      { name: "twitter:description", content: "Built for first time home buyers looking for a plan - not just another savings account" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e993783f-528c-4928-b3ed-05a424747059/id-preview-feea84c9--d20de6ac-1a25-490f-9fbc-a06d3b5c6242.lovable.app-1778465246339.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e993783f-528c-4928-b3ed-05a424747059/id-preview-feea84c9--d20de6ac-1a25-490f-9fbc-a06d3b5c6242.lovable.app-1778465246339.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <UpgradeGateProvider>
        <PaymentTestModeBanner />
        <Outlet />
      </UpgradeGateProvider>
    </QueryClientProvider>
  );
}
