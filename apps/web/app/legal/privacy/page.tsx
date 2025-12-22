import { LegalPageFrame } from "@/components/LegalPageFrame";

export default function LegalPrivacyPage() {
  return (
    <LegalPageFrame title="Privacy Policy">
      <div className="grid gap-4 text-sm text-white/80">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold text-white">Last updated</div>
          <div className="mt-1 text-sm text-white/80">12/22/2025</div>
          <p className="mt-3">
            This Privacy Policy describes how GoEducate, Inc. (&quot;GoEducate,&quot; &quot;we,&quot; &quot;us,&quot; or
            &quot;our&quot;) collects, uses, shares, and protects information in connection with the GoEducate Talent platform
            (the &quot;Service&quot;).
          </p>
          <p className="mt-2 text-xs text-white/70">
            Template notice: this is a general template intended to be reviewed by counsel and tailored to your organization,
            jurisdiction, and youth/minor participant requirements (e.g., COPPA/FERPA considerations).
          </p>
        </div>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4" open>
          <summary className="cursor-pointer text-sm font-semibold text-white">1. Information We Collect</summary>
          <div className="mt-2 grid gap-2">
            <p>We may collect the following categories of information:</p>
            <ul className="list-disc pl-5">
              <li>
                <span className="font-semibold text-white">Account data</span> (e.g., email, role, authentication data).
              </li>
              <li>
                <span className="font-semibold text-white">Profile data</span> (e.g., name, school/team details, sport,
                position, contact fields you provide).
              </li>
              <li>
                <span className="font-semibold text-white">Content</span> (e.g., film submissions, notes, evaluations,
                messages/communications within the Service).
              </li>
              <li>
                <span className="font-semibold text-white">Payment data</span> (processed by third-party processors; we may
                store limited billing identifiers like customer/subscription IDs).
              </li>
              <li>
                <span className="font-semibold text-white">Device/usage data</span> (e.g., log data, IP address, timestamps,
                pages viewed, approximate location derived from IP).
              </li>
            </ul>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">2. How We Use Information</summary>
          <div className="mt-2 grid gap-2">
            <ul className="list-disc pl-5">
              <li>Provide, maintain, and improve the Service (including role-based access and workflows).</li>
              <li>Process transactions and manage subscriptions or registrations.</li>
              <li>Send service communications (e.g., confirmations, notifications, security alerts).</li>
              <li>Prevent fraud and abuse; maintain security and integrity.</li>
              <li>Comply with legal obligations and enforce our Terms and policies.</li>
            </ul>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">3. How Information Is Shared</summary>
          <div className="mt-2 grid gap-2">
            <p>We may share information:</p>
            <ul className="list-disc pl-5">
              <li>
                <span className="font-semibold text-white">Within the Service</span> according to role-based permissions
                (e.g., a coach viewing a player’s profile/film as permitted, evaluators viewing assigned submissions).
              </li>
              <li>
                <span className="font-semibold text-white">With service providers</span> who support operations (e.g., hosting,
                email delivery, analytics, media storage, payment processing).
              </li>
              <li>
                <span className="font-semibold text-white">For legal reasons</span> (e.g., to comply with law, protect safety,
                investigate fraud/abuse, or respond to lawful requests).
              </li>
              <li>
                <span className="font-semibold text-white">Business transfers</span> (e.g., merger, acquisition, or asset sale),
                subject to applicable law.
              </li>
            </ul>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">4. Cookies & Tracking</summary>
          <div className="mt-2 grid gap-2">
            <p>
              We may use cookies or similar technologies for authentication, preferences, and basic analytics. You can control
              cookies through your browser settings, but some Service features may not function without them.
            </p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">5. Data Retention</summary>
          <div className="mt-2 grid gap-2">
            <p>
              We retain information as long as necessary to provide the Service, comply with legal obligations, resolve
              disputes, and enforce agreements. Retention periods may vary by data type and purpose.
            </p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">6. Security</summary>
          <div className="mt-2 grid gap-2">
            <p>
              We implement reasonable administrative, technical, and physical safeguards designed to protect information.
              However, no system is completely secure and we cannot guarantee absolute security.
            </p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">7. Children / Student-Athletes</summary>
          <div className="mt-2 grid gap-2">
            <p>
              The Service may be used by student-athletes, including minors. If you are a parent/guardian, you may be asked to
              provide consent for a minor’s participation.
            </p>
            <p>
              If you want explicit alignment with youth privacy laws (e.g., COPPA) or education records frameworks (e.g., FERPA),
              we can add the appropriate language once you confirm how consent and school relationships are handled.
            </p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">8. Your Choices</summary>
          <div className="mt-2 grid gap-2">
            <ul className="list-disc pl-5">
              <li>Update certain profile information in the Service settings where available.</li>
              <li>Opt out of certain non-essential communications where provided.</li>
              <li>Request access, correction, or deletion subject to legal and operational requirements.</li>
            </ul>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">9. Changes to This Policy</summary>
          <div className="mt-2 grid gap-2">
            <p>
              We may update this Privacy Policy from time to time. Updates apply prospectively and become effective when posted.
              Continued use of the Service after posting indicates acceptance.
            </p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">10. Contact</summary>
          <div className="mt-2 grid gap-2">
            <p>
              Questions or requests? Use the in-app Contact page or email{" "}
              <span className="font-semibold text-white">info@goeducateinc.org</span>.
            </p>
          </div>
        </details>
      </div>
    </LegalPageFrame>
  );
}


