import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import ServiceWorkerRegistration from "@/components/pwa/ServiceWorkerRegistration";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Clarity",
  description: "Personal planning and household coordination",
  applicationName: "Clarity",
  // iOS ignores the manifest and reads these instead, so an install from Safari
  // still opens without browser chrome and with the right home-screen artwork.
  appleWebApp: {
    capable: true,
    title: "Clarity",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

// No maximumScale/userScalable — pinch zoom stays available.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/*
          Chrome fires beforeinstallprompt once, and often before React has
          hydrated — a listener added in an effect can miss it entirely. Catch it
          here, park it on window, and tell InstallButton it has arrived.

          Deliberately WITHOUT preventDefault: that is what suppresses the
          browser's own install UI, which is the offer people actually expect —
          the icon in the desktop address bar, the prompt on Android. Letting it
          through means the browser leads and the in-app row is the fallback for
          browsers that never offer anything.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.addEventListener('beforeinstallprompt',function(e){window.__clarityInstallPrompt=e;window.dispatchEvent(new Event('clarity:installprompt'))});",
          }}
        />
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
