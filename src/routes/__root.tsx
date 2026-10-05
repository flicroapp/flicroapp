import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import appCss from "../styles.css?url";

const APP_NAME = "Flicro";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content" },
      { name: "apple-mobile-web-app-title", content: APP_NAME },
      { title: `${APP_NAME} — Fast Direct File Transfer` },
      {
        name: "description",
        content: "Flicro sends files directly from one device to another with high-speed peer-to-peer Wi-Fi transfer.",
      },
      { name: "theme-color", content: "#2563eb" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "google-site-verification", content: "ZZQFOj8aLtI565Hjev8yj4bVx6WZG5LFpCjiCKK1JYA" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "icon", type: "image/png", sizes: "180x180", href: "/flicro-icon-180.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: "/* href=\"/__grok/manifest.webmanifest\" */try{if(localStorage.getItem('flicro-theme')==='dark'){document.documentElement.dataset.theme='dark'}}catch(e){}",
          }}
        />
        <HeadContent />
      </head>
      <body className="font-sans antialiased">
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
