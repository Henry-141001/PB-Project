import Link from "next/link";
import { Logo } from "@/components/common";

export default function NotFound() {
  return (
    <div className="not-found">
      <div>
        <Logo size="lg" />
        <h2 style={{ fontStyle: "italic", margin: "12px 0 6px" }}>Page not found</h2>
        <p className="hint" style={{ marginBottom: 16 }}>This tournament or match doesn&apos;t exist, or you don&apos;t have access to it.</p>
        <Link className="btn btn-primary" href="/dashboard">Go to my tournaments</Link>
      </div>
    </div>
  );
}
