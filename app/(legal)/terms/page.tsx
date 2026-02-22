import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — Aviary",
  description: "Aviary terms of service",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
        <Link
          href="/dashboard"
          className="mb-8 inline-flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-amber-700 dark:hover:text-amber-400"
        >
          &larr; Back to Aviary
        </Link>

        <h1 className="mb-2 text-3xl font-black tracking-tight text-gray-900 dark:text-white">
          Terms of Service
        </h1>
        <p className="mb-8 text-sm text-gray-400">
          Last updated: February 22, 2026
        </p>

        <div className="prose prose-sm prose-gray max-w-none dark:prose-invert prose-headings:font-bold prose-headings:tracking-tight prose-a:text-amber-700 dark:prose-a:text-amber-400">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using Aviary (the &quot;Service&quot;), operated by Greg Bigelow, you
            agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to
            these Terms, do not use the Service.
          </p>

          <h2>2. Description of Service</h2>
          <p>
            Aviary is an expense-splitting application that allows users to create groups, record
            shared expenses, and calculate simplified debts among group members. The Service is
            provided free of charge.
          </p>

          <h2>3. Account Registration</h2>
          <p>To use the Service, you must:</p>
          <ul>
            <li>Be at least 13 years of age</li>
            <li>Provide accurate and complete registration information</li>
            <li>Maintain the security of your account credentials</li>
            <li>Notify us immediately of any unauthorized use of your account</li>
          </ul>
          <p>
            You are solely responsible for all activity that occurs under your account.
          </p>

          <h2>4. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the Service for any unlawful purpose</li>
            <li>Attempt to gain unauthorized access to the Service or its systems</li>
            <li>
              Interfere with or disrupt the Service or servers/networks connected to the Service
            </li>
            <li>Upload or transmit viruses, malware, or other malicious code</li>
            <li>
              Use the Service to harass, abuse, or harm other users
            </li>
            <li>
              Scrape, crawl, or use automated means to access the Service without permission
            </li>
            <li>Impersonate another person or entity</li>
            <li>Use the Service to send spam or unsolicited communications</li>
          </ul>

          <h2>5. User Content</h2>
          <p>
            You retain ownership of all data you enter into the Service (group names, expense
            descriptions, amounts, etc.). By using the Service, you grant us a limited license to
            store, process, and display this data solely for the purpose of providing the Service to
            you and your group members.
          </p>
          <p>
            You are solely responsible for the accuracy of financial information you enter. The
            Service performs mathematical calculations on the data you provide but does not verify
            its accuracy or completeness.
          </p>

          <h2>6. Financial Disclaimer</h2>
          <p>
            <strong>
              Aviary is a record-keeping and calculation tool only. It is not a financial service,
              payment processor, or debt collection service.
            </strong>
          </p>
          <ul>
            <li>
              The Service does not facilitate, process, or guarantee any actual financial
              transactions or payments between users.
            </li>
            <li>
              Balances and debts displayed in the Service are informational only and represent
              calculations based on user-entered data.
            </li>
            <li>
              We make no representations about the accuracy of calculations beyond the mathematical
              operations performed on user-provided data.
            </li>
            <li>
              We are not responsible for any disputes between users regarding debts, expenses, or
              payments.
            </li>
            <li>
              The Service does not constitute financial, legal, or tax advice.
            </li>
          </ul>

          <h2>7. Disclaimer of Warranties</h2>
          <p>
            THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES
            OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES
            OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          </p>
          <p>We do not warrant that:</p>
          <ul>
            <li>The Service will be uninterrupted, timely, secure, or error-free</li>
            <li>The results obtained from the Service will be accurate or reliable</li>
            <li>Any errors in the Service will be corrected</li>
            <li>The Service will meet your specific requirements</li>
          </ul>

          <h2>8. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL AVIARY, ITS
            OPERATOR, OR ITS SERVICE PROVIDERS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
            CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, USE, GOODWILL, OR
            OTHER INTANGIBLE LOSSES, RESULTING FROM:
          </p>
          <ul>
            <li>YOUR USE OR INABILITY TO USE THE SERVICE</li>
            <li>ANY UNAUTHORIZED ACCESS TO OR USE OF OUR SERVERS OR YOUR DATA</li>
            <li>ANY ERRORS, INACCURACIES, OR OMISSIONS IN THE SERVICE</li>
            <li>
              ANY FINANCIAL DISPUTES OR LOSSES ARISING FROM RELIANCE ON INFORMATION PROVIDED BY THE
              SERVICE
            </li>
            <li>ANY THIRD-PARTY CONDUCT ON THE SERVICE</li>
          </ul>
          <p>
            OUR TOTAL LIABILITY FOR ALL CLAIMS RELATED TO THE SERVICE SHALL NOT EXCEED THE AMOUNT
            YOU PAID US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, WHICH, AS THE SERVICE IS
            FREE, IS ZERO DOLLARS ($0.00).
          </p>

          <h2>9. Indemnification</h2>
          <p>
            You agree to indemnify, defend, and hold harmless Aviary and its operator from and
            against any and all claims, damages, losses, liabilities, costs, and expenses (including
            reasonable attorneys&apos; fees) arising from or related to:
          </p>
          <ul>
            <li>Your use of the Service</li>
            <li>Your violation of these Terms</li>
            <li>Your violation of any rights of a third party</li>
            <li>Any content or data you submit to the Service</li>
          </ul>

          <h2>10. Service Availability and Termination</h2>
          <p>
            We reserve the right to modify, suspend, or discontinue the Service (in whole or in
            part) at any time, with or without notice. We may also terminate or suspend your account
            at our sole discretion, without prior notice, for conduct that we determine violates
            these Terms or is otherwise harmful to the Service or other users.
          </p>

          <h2>11. Changes to Terms</h2>
          <p>
            We may revise these Terms at any time by updating this page. The &quot;Last
            updated&quot; date at the top will reflect the most recent revision. Your continued use
            of the Service after changes constitutes acceptance of the revised Terms.
          </p>

          <h2>12. Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the United
            States, without regard to conflict of law principles.
          </p>

          <h2>13. Severability</h2>
          <p>
            If any provision of these Terms is found to be unenforceable or invalid, that provision
            shall be limited or eliminated to the minimum extent necessary, and the remaining
            provisions shall remain in full force and effect.
          </p>

          <h2>14. Entire Agreement</h2>
          <p>
            These Terms, together with our{" "}
            <Link href="/privacy">Privacy Policy</Link>, constitute the entire agreement between you
            and Aviary regarding your use of the Service.
          </p>

          <h2>15. Contact</h2>
          <p>
            For questions about these Terms, contact us at the email address associated with the
            Service operator.
          </p>
        </div>

        <div className="mt-12 border-t border-gray-200 pt-6 dark:border-gray-800">
          <p className="text-xs text-gray-400">
            <Link href="/privacy" className="hover:text-amber-700 dark:hover:text-amber-400">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
