import Image from "next/image";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ kicked?: string }>;
}) {
  if (await getSessionUser()) redirect("/");
  const { kicked } = await searchParams;

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand" style={{ padding: 0, marginBottom: 18 }}>
          <div className="brand-mark photo">
            <Image src="/icons/icon-192.png" alt="" width={34} height={34} priority />
          </div>
          <div>
            <div className="brand-name">Class Hub</div>
            <div className="brand-sub">S3 Earth CSE</div>
          </div>
        </div>
        <h1>Welcome back</h1>
        <p className="sub">Settle in. Your classes, notes and progress are right where you left them.</p>
        {kicked ? (
          <div className="notice">
            This account was signed in on another device, so this session was closed. Sign in again to take it back.
          </div>
        ) : null}
        <LoginForm />
        <div className="foot-note">
          Private library · personal use only
          <div className="footer-credit">Made for Ammachi fans</div>
        </div>
      </div>
    </div>
  );
}
