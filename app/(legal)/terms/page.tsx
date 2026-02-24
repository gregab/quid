import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — Aviary",
  description: "Aviary terms of service",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
        <Link
          href="/dashboard"
          className="mb-8 inline-flex items-center gap-1 text-sm text-stone-400 transition-colors hover:text-amber-700 dark:hover:text-amber-400"
        >
          &larr; Back to Aviary
        </Link>

        <h1 className="mb-2 text-3xl font-black tracking-tight text-stone-900 dark:text-white">
          Terms of Service
        </h1>
        <p className="mb-8 text-sm text-stone-400">
          Last updated: February 22, 2026
        </p>

        <div className="prose prose-sm prose-stone max-w-none dark:prose-invert prose-headings:font-bold prose-headings:tracking-tight prose-a:text-amber-700 dark:prose-a:text-amber-400">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using Aviary (the &quot;Service&quot;), operated by Greg Bigelow
            (&quot;Operator&quot;), you agree to be bound by these Terms of Service
            (&quot;Terms&quot;). If you do not agree to these Terms in their entirety, you must not
            access or use the Service.
          </p>
          <p>
            <strong>
              The Service is intended solely for users located in the United States. By using the
              Service, you represent and warrant that you are located in the United States and are
              subject to United States law. If you are located outside the United States, you may not
              use the Service.
            </strong>
          </p>

          <h2>2. Description of Service</h2>
          <p>
            Aviary is a personal expense-splitting application that allows users to create groups,
            record shared expenses, and calculate simplified debts among group members. The Service
            is provided free of charge, as-is, by an individual developer. It is not backed by any
            company, team, or enterprise service level agreement.
          </p>

          <h2>3. Account Registration</h2>
          <p>To use the Service, you must:</p>
          <ul>
            <li>Be at least 13 years of age</li>
            <li>Be located in the United States</li>
            <li>Provide accurate and complete registration information</li>
            <li>Maintain the security and confidentiality of your account credentials</li>
            <li>Notify us immediately of any unauthorized use of your account</li>
          </ul>
          <p>
            You are solely responsible for all activity that occurs under your account, whether or
            not you authorized that activity. We are not liable for any loss or damage arising from
            your failure to secure your account credentials.
          </p>

          <h2>4. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the Service for any unlawful purpose or in violation of any applicable law</li>
            <li>
              Attempt to gain unauthorized access to the Service, its systems, or other
              users&apos; accounts
            </li>
            <li>
              Interfere with or disrupt the Service, its servers, or networks connected to the
              Service
            </li>
            <li>Upload or transmit viruses, malware, or other malicious code</li>
            <li>Use the Service to harass, abuse, threaten, or harm other users</li>
            <li>
              Scrape, crawl, or use automated means to access the Service without prior written
              permission
            </li>
            <li>Impersonate another person or entity</li>
            <li>
              Use the Service to send spam, unsolicited communications, or for any commercial
              purpose unrelated to expense splitting
            </li>
            <li>
              Attempt to reverse engineer, decompile, or disassemble any portion of the Service
            </li>
            <li>Use the Service in any way that could damage, disable, or impair the Service</li>
          </ul>
          <p>
            Violation of these terms may result in immediate termination of your account without
            notice.
          </p>

          <h2>5. User Content</h2>
          <p>
            You retain ownership of all data you enter into the Service (group names, expense
            descriptions, amounts, etc.). By using the Service, you grant us a limited,
            non-exclusive, royalty-free license to store, process, and display this data solely for
            the purpose of providing the Service to you and your group members.
          </p>
          <p>
            You are solely responsible for the accuracy of all information you enter, including
            financial amounts. The Service performs mathematical calculations on the data you
            provide but does not verify its accuracy, completeness, or legitimacy. The Service does
            not verify the identity of group members beyond their email address.
          </p>

          <h2>6. Financial Disclaimer</h2>
          <p>
            <strong>
              AVIARY IS A RECORD-KEEPING AND CALCULATION TOOL ONLY. IT IS NOT A FINANCIAL SERVICE,
              PAYMENT PROCESSOR, MONEY TRANSMITTER, MONEY SERVICES BUSINESS, FINANCIAL INSTITUTION,
              OR DEBT COLLECTION SERVICE.
            </strong>
          </p>
          <ul>
            <li>
              The Service does not facilitate, process, or guarantee any actual financial
              transactions or payments between users.
            </li>
            <li>
              Balances and debts displayed in the Service are informational only and represent
              calculations based entirely on user-entered data. They are not legally binding
              obligations.
            </li>
            <li>
              Calculations are based solely on user-entered data and may contain errors introduced
              by users. We make no representations about the accuracy of results beyond the
              mathematical operations performed on user-provided inputs.
            </li>
            <li>
              Users are solely responsible for settling debts outside of the Service. We have no
              involvement in, and accept no liability for, the actual transfer of money between
              users.
            </li>
            <li>
              We are not responsible for any disputes between users regarding debts, expenses, or
              payments.
            </li>
            <li>
              The Service does not constitute financial, legal, tax, or accounting advice. Consult a
              qualified professional for such matters.
            </li>
            <li>
              You should not rely on the Service as your sole record of financial obligations. You
              are responsible for maintaining your own independent records.
            </li>
          </ul>

          <h2>7. Intellectual Property</h2>
          <p>
            The Service, including its design, source code, graphics, user interface, and any
            trademarks or branding, is owned by the Operator and is protected by applicable
            intellectual property laws. These Terms do not grant you any right, title, or interest in
            the Service beyond the limited right to use it in accordance with these Terms.
          </p>

          <h2>8. Disclaimer of Warranties</h2>
          <p>
            THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES
            OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES
            OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, ACCURACY,
            RELIABILITY, AND AVAILABILITY.
          </p>
          <p>We do not warrant that:</p>
          <ul>
            <li>The Service will be uninterrupted, timely, secure, or error-free</li>
            <li>
              The results obtained from the Service will be accurate, reliable, or complete
            </li>
            <li>Any errors in the Service will be corrected</li>
            <li>The Service will meet your specific requirements or expectations</li>
            <li>The Service will be available at any particular time or location</li>
            <li>
              Data entered into the Service will be preserved indefinitely or without corruption
            </li>
          </ul>
          <p>
            THE SERVICE IS OPERATED BY AN INDIVIDUAL DEVELOPER AND IS NOT BACKED BY AN ENTERPRISE
            SERVICE LEVEL AGREEMENT. DOWNTIME, DATA LOSS, SERVICE INTERRUPTIONS, BUGS, AND ERRORS
            MAY OCCUR. YOU ACKNOWLEDGE AND ACCEPT THESE RISKS AND AGREE NOT TO RELY ON THE SERVICE
            AS YOUR SOLE RECORD OF FINANCIAL OBLIGATIONS BETWEEN YOU AND OTHER PERSONS.
          </p>

          <h2>9. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL THE OPERATOR, HIS
            AFFILIATES, OR HIS SERVICE PROVIDERS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
            CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA,
            USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM:
          </p>
          <ul>
            <li>YOUR USE OR INABILITY TO USE THE SERVICE</li>
            <li>
              ANY UNAUTHORIZED ACCESS TO OR ALTERATION OF YOUR DATA OR TRANSMISSIONS
            </li>
            <li>ANY ERRORS, INACCURACIES, OMISSIONS, OR BUGS IN THE SERVICE</li>
            <li>
              ANY FINANCIAL DISPUTES, LOSSES, OR DAMAGES ARISING FROM YOUR RELIANCE ON INFORMATION
              PROVIDED BY THE SERVICE
            </li>
            <li>
              ANY DISPUTES BETWEEN USERS REGARDING EXPENSES, DEBTS, OR PAYMENTS
            </li>
            <li>ANY THIRD-PARTY CONDUCT ON OR THROUGH THE SERVICE</li>
            <li>
              ANY INTERRUPTION, SUSPENSION, OR TERMINATION OF THE SERVICE
            </li>
            <li>
              ANY DATA LOSS, CORRUPTION, OR BREACH, REGARDLESS OF WHETHER WE WERE ADVISED OF THE
              POSSIBILITY OF SUCH DAMAGES
            </li>
          </ul>
          <p>
            OUR TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS RELATED TO THE SERVICE SHALL NOT EXCEED THE
            GREATER OF (A) THE AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR
            (B) ONE DOLLAR ($1.00). AS THE SERVICE IS PROVIDED FREE OF CHARGE, THIS AMOUNT IS ONE
            DOLLAR ($1.00).
          </p>
          <p>
            SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OR LIMITATION OF CERTAIN DAMAGES. IN SUCH
            JURISDICTIONS, OUR LIABILITY SHALL BE LIMITED TO THE MAXIMUM EXTENT PERMITTED BY LAW.
          </p>

          <h2>10. Indemnification</h2>
          <p>
            You agree to indemnify, defend, and hold harmless the Operator from and against any and
            all claims, damages, losses, liabilities, costs, and expenses (including reasonable
            attorneys&apos; fees and court costs) arising from or related to:
          </p>
          <ul>
            <li>Your use of or access to the Service</li>
            <li>Your violation of these Terms</li>
            <li>Your violation of any rights of a third party</li>
            <li>Any content or data you submit to the Service</li>
            <li>
              Any dispute between you and another user of the Service
            </li>
            <li>
              Your negligence or willful misconduct
            </li>
          </ul>
          <p>
            This indemnification obligation shall survive the termination of these Terms and your use
            of the Service.
          </p>

          <h2>11. Dispute Resolution and Arbitration</h2>
          <p>
            <strong>PLEASE READ THIS SECTION CAREFULLY. IT AFFECTS YOUR LEGAL RIGHTS, INCLUDING
            YOUR RIGHT TO FILE A LAWSUIT IN COURT.</strong>
          </p>
          <h3>Informal Resolution First</h3>
          <p>
            Before initiating any formal dispute resolution proceeding, you agree to first contact
            the Operator and attempt to resolve the dispute informally for at least 30 days. If the
            dispute is not resolved within 30 days, either party may proceed as described below.
          </p>
          <h3>Binding Arbitration</h3>
          <p>
            Any dispute, claim, or controversy arising out of or relating to these Terms or the
            Service that cannot be resolved informally shall be resolved by binding individual
            arbitration administered by the American Arbitration Association (&quot;AAA&quot;) under
            its Consumer Arbitration Rules then in effect. Arbitration shall take place in the State
            of Oregon, or at another mutually agreed location. The arbitrator&apos;s decision shall
            be final and binding and may be entered as a judgment in any court of competent
            jurisdiction.
          </p>
          <h3>Class Action Waiver</h3>
          <p>
            <strong>
              YOU AND THE OPERATOR AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN YOUR
              OR HIS INDIVIDUAL CAPACITY, AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED
              CLASS, CONSOLIDATED, OR REPRESENTATIVE PROCEEDING.
            </strong>{" "}
            The arbitrator may not consolidate more than one person&apos;s claims and may not
            preside over any form of class or representative proceeding.
          </p>
          <h3>Small Claims Exception</h3>
          <p>
            Notwithstanding the above, either party may bring an individual action in small claims
            court for disputes within that court&apos;s jurisdictional limits.
          </p>
          <h3>Opt-Out</h3>
          <p>
            You may opt out of this arbitration provision by sending written notice to the Operator
            within 30 days of first creating your account. If you opt out, you and the Operator may
            pursue claims in court, subject to the governing law and jurisdiction provisions below.
          </p>

          <h2>12. Service Availability and Termination</h2>
          <p>
            We reserve the right to modify, suspend, or discontinue the Service (in whole or in
            part) at any time, with or without notice, for any reason or no reason. We may also
            terminate or suspend your account at our sole discretion, without prior notice or
            liability, for conduct that we determine violates these Terms or is otherwise harmful to
            the Service, other users, or third parties.
          </p>
          <p>
            We reserve the right to delete accounts that have been inactive for more than 24 months,
            with 30 days&apos; prior notice sent to the registered email address.
          </p>
          <p>
            Upon termination, your right to use the Service will immediately cease. Sections 5
            through 16 shall survive any termination of these Terms.
          </p>

          <h2>13. Force Majeure</h2>
          <p>
            We shall not be liable for any failure or delay in performing our obligations under
            these Terms where such failure or delay results from circumstances beyond our reasonable
            control, including but not limited to natural disasters, acts of government, internet or
            infrastructure outages, cyberattacks, pandemic, or third-party service provider failures
            (including but not limited to Supabase and Vercel).
          </p>

          <h2>14. Changes to Terms</h2>
          <p>
            We may revise these Terms at any time by updating this page. The &quot;Last
            updated&quot; date at the top will reflect the most recent revision. Material changes
            will be indicated by updating the date. Your continued use of the Service after changes
            are posted constitutes acceptance of the revised Terms. If you do not agree to the
            revised Terms, you must stop using the Service.
          </p>

          <h2>15. Governing Law and Jurisdiction</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the State
            of Oregon, United States, without regard to its conflict of law provisions. Subject to
            the arbitration provision in Section 11, any legal action or proceeding arising out of
            or relating to these Terms shall be brought exclusively in the state or federal courts
            located in Multnomah County, Oregon, and you consent to the personal jurisdiction of
            such courts.
          </p>

          <h2>16. General Provisions</h2>
          <h3>Severability</h3>
          <p>
            If any provision of these Terms is found to be unenforceable or invalid by a court of
            competent jurisdiction, that provision shall be enforced to the maximum extent
            permissible, and the remaining provisions shall remain in full force and effect.
          </p>
          <h3>Waiver</h3>
          <p>
            Our failure to enforce any right or provision of these Terms shall not be deemed a
            waiver of such right or provision. Any waiver must be in writing and signed by the
            Operator.
          </p>
          <h3>Assignment</h3>
          <p>
            You may not assign or transfer these Terms, or any rights or obligations hereunder,
            without the prior written consent of the Operator. The Operator may assign these Terms
            without restriction.
          </p>
          <h3>Entire Agreement</h3>
          <p>
            These Terms, together with our{" "}
            <Link href="/privacy">Privacy Policy</Link>, constitute the entire agreement between you
            and the Operator regarding your use of the Service, and supersede all prior agreements,
            communications, and understandings.
          </p>
          <h3>Electronic Communications</h3>
          <p>
            By creating an account, you consent to receive electronic communications from us
            (including account confirmations, security alerts, and service announcements). You agree
            that all agreements, notices, and other communications provided electronically satisfy
            any legal requirement that such communications be in writing.
          </p>

          <h2>17. Contact</h2>
          <p>
            For questions about these Terms, contact us via our support group at{" "}
            <a
              href="https://groups.google.com/g/aviary-support"
              target="_blank"
              rel="noopener noreferrer"
            >
              groups.google.com/g/aviary-support
            </a>
            .
          </p>
        </div>

        <div className="mt-12 border-t border-stone-200 pt-6 dark:border-stone-800">
          <p className="text-xs text-stone-400">
            <Link href="/privacy" className="hover:text-amber-700 dark:hover:text-amber-400">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
