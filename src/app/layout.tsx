import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Alika's Writing App",
  description: "Premium songwriting archive workspace",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="appShell">
          <Nav />
          <main className="mainArea">
            <div className="contentWrap">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
