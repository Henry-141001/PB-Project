import Link from "next/link";
import { CourtIcon, PaddlesIcon } from "@/components/icons";

export default function RolePage() {
  return (
    <>
      <Link className="btn btn-outline btn-sm back" href="/">← Back</Link>
      <section className="hero-main role-page">
        <div className="slogan-card">
          <div className="slogan"><i>P</i>lay the<br />game .<br />Create the<br /><i>Throne</i></div>
        </div>
        <div className="role-card">
          <h4>Register your <i>Role</i> as :</h4>
          <Link className="role-btn" href="/signup?role=Organizer"><CourtIcon /><span>Organizer</span></Link>
          <Link className="role-btn" href="/signup?role=Player"><PaddlesIcon /><span>Player</span></Link>
          <p className="small">Already have an account?<br />proceed to login</p>
          <Link className="btn btn-outline btn-block" href="/login">Login</Link>
        </div>
      </section>
    </>
  );
}
