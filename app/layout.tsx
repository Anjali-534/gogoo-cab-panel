import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "gogoo Cab Operations Panel",
  description: "Cab Operations Dashboard — gogoo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
