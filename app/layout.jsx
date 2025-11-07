import "./globals.css";
import { Inter } from "next/font/google";
import SiteHeader from "@/components/navigation/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import AuthProvider from "@/components/providers/AuthProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "MathArcade — Connected math games with synced progress",
  description:
    "Host 100 math mini-games on Next.js, track every session, and map progress across strands.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <SiteHeader />
          <main className="main">{children}</main>
          <SiteFooter />
        </AuthProvider>
      </body>
    </html>
  );
}
