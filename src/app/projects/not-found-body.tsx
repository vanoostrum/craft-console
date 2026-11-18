"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShadeSwitch } from "../shade-switch";
import { TopBar } from "../top-bar";

/**
 * The 404 page of a project page with no sessions. A `not-found.tsx` gets no
 * params, so it shows the repository from the path.
 */
export function NotFoundBody() {
  const path = usePathname();
  const repository = decodeURIComponent(path.replace(/^\/projects\//, ""));
  return (
    <>
      <TopBar current="/" tools={<ShadeSwitch path={path} current="cost" />} />
      <main>
        <p className="crumbs">
          <Link href="/">Projects</Link> / {repository}
        </p>
        <section className="panel" aria-labelledby="nf-title">
          <div className="panel-head">
            <h1 id="nf-title">
              No sessions for {repository}{" "}
              <span className="sub">
                / craft has no session in this repository. Check the address, or
                go back to Projects.
              </span>
            </h1>
            <Link className="primary" href="/">
              Back to Projects
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
