import { requireUser } from "@/lib/auth";
import { initials } from "@/lib/format";
import Sidebar from "@/components/Sidebar";
import Footer from "@/components/Footer";
import { appVersion } from "@/lib/version";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="shell">
      <Sidebar displayName={user.displayName} username={user.username} initials={initials(user.displayName)} role={user.role} appVersion={appVersion()} />
      <main className="main">
        {children}
        <Footer />
      </main>
    </div>
  );
}
