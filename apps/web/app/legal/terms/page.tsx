import { LegalPageFrame } from "@/components/LegalPageFrame";

export default function LegalTermsPage() {
  return (
    <LegalPageFrame title="Terms of Service">
      <div className="grid gap-4 text-sm text-white/80">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold text-white">Last updated</div>
          <div className="mt-1 text-sm text-white/80">12/22/2025</div>
          <p className="mt-3">
            These Terms of Service (&quot;Terms&quot;) govern access to and use of the GoEducate Talent platform and related
            services (collectively, the &quot;Service&quot;). By accessing or using the Service, you agree to these Terms.
          </p>
          <p className="mt-2 text-xs text-white/70">
            Template notice: this is a general template intended to be reviewed by counsel and tailored to your organization,
            jurisdiction, and program requirements.
          </p>
        </div>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4" open>
          <summary className="cursor-pointer text-sm font-semibold text-white">1. Definitions</summary>
          <div className="mt-2 grid gap-2">
            <p>
              <span className="font-semibold text-white">“GoEducate,” “we,” “us,”</span> or <span className="font-semibold text-white">“our”</span>{" "}
              means GoEducate, Inc.
            </p>
            <p>
              <span className="font-semibold text-white">“You”</span> means the individual or entity using the Service. If you
              use the Service on behalf of an organization, you represent you have authority to bind that organization.
            </p>
            <p>
              <span className="font-semibold text-white">“Content”</span> includes information, text, images, video, audio, and
              other materials uploaded, submitted, posted, or otherwise made available through the Service.
            </p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">2. Eligibility, Minors, and Guardian Consent</summary>
          <div className="mt-2 grid gap-2">
            <p>
              You must be eligible to use the Service under applicable law. If a participant is a minor, a parent or legal
              guardian may be required to provide consent and may be responsible for the minor’s use.
            </p>
            <p>
              We may require additional verification for certain roles (e.g., evaluator/admin) and may reject or revoke access
              in our discretion.
            </p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">3. Accounts & Security</summary>
          <div className="mt-2 grid gap-2">
            <p>
              You agree to provide accurate information, maintain the confidentiality of your login credentials, and promptly
              notify us of any suspected unauthorized access.
            </p>
            <p>
              You are responsible for all activities that occur under your account. We may suspend accounts to protect users,
              the Service, or third parties.
            </p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">4. Roles, Access Controls, and Use of Data</summary>
          <div className="mt-2 grid gap-2">
            <p>
              The Service uses role-based access controls (e.g., player, coach, evaluator, admin). Your access may be limited
              based on your role and subscription status.
            </p>
            <p>
              You agree not to attempt to access data or features you are not authorized to access, and not to scrape,
              replicate, or bulk export information except as expressly permitted.
            </p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">5. Acceptable Use</summary>
          <div className="mt-2 grid gap-2">
            <p>You agree not to:</p>
            <ul className="list-disc pl-5">
              <li>Upload unlawful, infringing, or harmful content;</li>
              <li>Harass, threaten, exploit, or impersonate others;</li>
              <li>Introduce malware or attempt to bypass security;</li>
              <li>Reverse engineer, resell, or misuse the Service;</li>
              <li>Use the Service to collect personal data in violation of applicable law.</li>
            </ul>
            <p>We may remove Content or restrict access to enforce these Terms and protect the community.</p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">6. User Content, Rights, and Licenses</summary>
          <div className="mt-2 grid gap-2">
            <p>
              You retain ownership of your Content. You grant GoEducate a worldwide, non-exclusive, royalty-free license to
              host, store, reproduce, transmit, display, and distribute your Content as necessary to operate and improve the
              Service, including facilitating evaluation workflows and sharing authorized views with permitted roles.
            </p>
            <p>
              You represent you have the necessary rights to upload your Content and that your Content does not violate law or
              third-party rights.
            </p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">7. Evaluations & Disclaimers</summary>
          <div className="mt-2 grid gap-2">
            <p>
              Evaluations, grades, projections, and reports are informational opinions based on the evaluator’s judgment and
              available materials. They are not guarantees of athletic performance, scholarship, recruitment, playing time, or
              outcomes.
            </p>
            <p>
              The Service does not provide medical advice. Consult qualified professionals for medical, training, or safety
              guidance.
            </p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">8. Payments, Subscriptions, and Event Registrations</summary>
          <div className="mt-2 grid gap-2">
            <p>
              Certain features may require payment (e.g., coach subscriptions, showcase registrations). Prices, renewal terms,
              and billing policies will be disclosed at checkout or in the Service.
            </p>
            <p>
              Refunds for showcases are governed by the showcase-specific refund policy and weather clause displayed on the
              registration page. By registering, you acknowledge and agree to those terms.
            </p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">9. Third-Party Services</summary>
          <div className="mt-2 grid gap-2">
            <p>
              The Service may integrate third-party services (e.g., payment processors, email providers, media hosting). Your
              use of those services may be subject to their terms and policies.
            </p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">10. Suspension & Termination</summary>
          <div className="mt-2 grid gap-2">
            <p>
              We may suspend or terminate your access if we believe you violated these Terms, pose a security risk, or to
              comply with law. You may stop using the Service at any time.
            </p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">11. Warranty Disclaimer</summary>
          <div className="mt-2 grid gap-2">
            <p>
              To the maximum extent permitted by law, the Service is provided &quot;as is&quot; and &quot;as available&quot;
              without warranties of any kind, whether express, implied, or statutory.
            </p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">12. Limitation of Liability</summary>
          <div className="mt-2 grid gap-2">
            <p>
              To the maximum extent permitted by law, GoEducate will not be liable for indirect, incidental, special,
              consequential, or punitive damages, or any loss of profits, data, or goodwill, arising from or related to use of
              the Service.
            </p>
            <p>
              In any event, GoEducate’s total liability for any claim will not exceed the amount paid by you to GoEducate in
              the twelve (12) months preceding the event giving rise to the claim, or USD $100 if you have not paid anything,
              unless required otherwise by law.
            </p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">13. Indemnification</summary>
          <div className="mt-2 grid gap-2">
            <p>
              You agree to indemnify and hold harmless GoEducate from and against claims arising from your Content, your use of
              the Service, or your violation of these Terms or applicable law.
            </p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">14. Governing Law & Dispute Resolution</summary>
          <div className="mt-2 grid gap-2">
            <p>
              Governing law and venue should be set based on your organization’s jurisdiction. Recommended placeholders:
              <span className="font-semibold text-white"> [Insert State] </span>law, venue in
              <span className="font-semibold text-white"> [Insert County/State]</span>.
            </p>
            <p>
              Optional: arbitration clause and class action waiver can be added if desired and reviewed by counsel.
            </p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">15. Changes</summary>
          <div className="mt-2 grid gap-2">
            <p>
              We may update these Terms from time to time. Updated Terms apply prospectively and will be effective when posted.
              Continued use after posting indicates acceptance.
            </p>
          </div>
        </details>

        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">16. Contact</summary>
          <div className="mt-2 grid gap-2">
            <p>
              Questions? Use the in-app Contact page or email <span className="font-semibold text-white">info@goeducateinc.org</span>.
            </p>
          </div>
        </details>
      </div>
    </LegalPageFrame>
  );
}


