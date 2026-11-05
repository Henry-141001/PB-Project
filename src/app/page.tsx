import Link from "next/link";

const CARDS = [
  { title: <>Internal<br />Tournament</>, text: "Suitable for family or office mates that want to create a small tournament or league that is less than 4 teams." },
  { title: <>Internal +<br />Tournament</>, text: "Suitable for internal local tournaments, corporate agencies that host internal tournaments with more than 4 teams." },
  { title: <>External *<br />Tournament</>, text: "Join a tournament / create your own competitive tournament." },
];

export default function Landing() {
  return (
    <section className="hero-top">
      <div className="corner-arrow" aria-hidden="true">↙</div>
      <h1>Make everyone Play</h1>
      <div className="type-grid">
        {CARDS.map((c, i) => (
          <Link key={i} href="/role" className="type-card">
            <h3>{c.title}</h3>
            <p>{c.text}</p>
          </Link>
        ))}
      </div>
      <div className="start-row"><Link className="btn btn-start" href="/role">Get Started →</Link></div>
    </section>
  );
}
