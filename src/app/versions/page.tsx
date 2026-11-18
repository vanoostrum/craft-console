import type { Metadata } from "next";
import Link from "next/link";
import { TopBar } from "../top-bar";

export const metadata: Metadata = { title: "Craft versions · Craft Console" };

export default function CraftVersionsPage() {
  return (
    <>
      <TopBar current="/versions" />
      <main>
        <section className="panel" aria-labelledby="versions-title">
          <div className="panel-head">
            <h1 id="versions-title">Craft versions</h1>
          </div>
          <p className="panel-body">
            The average cost and craft time per phase, by craft version, comes
            with Craft Console v1.
          </p>
          <p className="panel-body actions">
            <Link className="primary" href="/">
              Back to Projects
            </Link>
          </p>
        </section>
      </main>
    </>
  );
}
