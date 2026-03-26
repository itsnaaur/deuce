import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Sora } from "next/font/google";
import "./globals.css";

const display = Sora({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
  display: "swap",
});

const ui = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-ui",
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Deuce",
  description: "Offline-first badminton session management — roster, fair queue, courts.",
  applicationName: "Deuce",
  icons: {
    icon: "/branding/deuce-icon-logo.png",
    apple: "/branding/deuce-icon-logo.png",
  },
  appleWebApp: {
    capable: true,
    title: "Deuce",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#050b14",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${display.variable} ${ui.variable}`}
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
