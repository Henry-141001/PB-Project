import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { UIProvider } from "@/components/ui";
import "./globals.css";
import "./app.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "PB+ Pickleball Score Board",
  description: "Create pickleball tournaments, join with a code, and keep live scores.",
};

export const viewport: Viewport = { themeColor: "#ff5a1f" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className={poppins.className}>
        <UIProvider>{children}</UIProvider>
      </body>
    </html>
  );
}
