import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { RegisterServiceWorker } from "@/components/pwa/RegisterServiceWorker";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: { default: "Task Master", template: "%s · Task Master" },
  description: "Your day, your to-dos and a weekly review in one place.",
  applicationName: "Task Master",
  appleWebApp: { capable: true, title: "Task Master", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

// viewportFit lets the phone tab bar pad itself for the home indicator (env(safe-area-inset-bottom)).
// themeColor matches the page background (--background) so the browser and status bars blend in;
// it follows the device setting, not the in-app theme toggle.
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1015" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <RegisterServiceWorker />
        </ThemeProvider>
      </body>
    </html>
  );
}
