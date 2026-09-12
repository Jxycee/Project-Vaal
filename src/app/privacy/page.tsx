import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-3xl px-4 py-16">
      <Link
        href="/"
        className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        &larr; Back to home
      </Link>

      <h1 className="font-heading mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
        Privacy Policy
      </h1>

      <p className="mt-2 text-sm text-muted-foreground">Effective date: [EFFECTIVE DATE]</p>

      <Card className="mt-6 border-destructive/40 bg-destructive/10">
        <CardContent className="text-sm leading-relaxed text-foreground">
          <p className="font-medium">
            This is a general template, not legal advice — have an attorney review before
            relying on it.
          </p>
          <p className="mt-2 text-muted-foreground">
            This page is a starting point for [OPERATOR NAME] to adapt. It has not been reviewed
            by a lawyer and should not be published or relied on as-is.
          </p>
        </CardContent>
      </Card>

      <div className="mt-10 space-y-8 text-sm leading-relaxed sm:text-base">
        <section>
          <p>
            Project Vaal (&ldquo;Project Vaal,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
            &ldquo;our&rdquo;) is a free, unofficial companion web application for Path of Exile
            2 (PoE2) players — offering currency and item price checks, an interactive passive
            skill tree viewer/planner, a campaign checkpoint tracker, and a build
            planner/saver. Project Vaal is not affiliated with, endorsed by, or sponsored by
            Grinding Gear Games (GGG).
          </p>
          <p className="mt-3">
            This Privacy Policy explains what information we collect, how we use it, who we
            share it with, and what rights you have regarding it. By using Project Vaal, you
            agree to the collection and use of information as described here. See also our{' '}
            <Link href="/terms" className="text-primary underline-offset-4 hover:underline">
              Terms of Service
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            Information We Collect
          </h2>

          <h3 className="mt-4 font-medium">Account data</h3>
          <p className="mt-2">
            If you create an account, we use Supabase Auth to manage sign-in. Depending on how
            you sign up, we (via Supabase) store either:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>your email address and a hashed password (for email/password sign-in), or</li>
            <li>
              your Google account identity (for &ldquo;Sign in with Google&rdquo;) — Project Vaal
              never sees or stores your Google password itself, only the identity information
              Google shares as part of the standard OAuth sign-in exchange.
            </li>
          </ul>

          <h3 className="mt-4 font-medium">Optional GGG account connection</h3>
          <p className="mt-2">
            If you choose to connect your Grinding Gear Games (GGG) account, we store your linked
            GGG account name and the GGG OAuth access and refresh tokens issued to us. These
            tokens are stored encrypted at rest in our database — not in plaintext.
          </p>

          <h3 className="mt-4 font-medium">User-generated content</h3>
          <p className="mt-2">If you use Project Vaal&rsquo;s features, we store:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              saved &ldquo;builds&rdquo; — character class, passive skill tree selections,
              gear/gem loadout data, and any name, description, or notes text you write;
            </li>
            <li>your campaign checkpoint completion progress; and</li>
            <li>your preferred trade-league selection.</li>
          </ul>

          <h3 className="mt-4 font-medium">Automatically collected data</h3>
          <p className="mt-2">
            We use Vercel Web Analytics (<code>@vercel/analytics</code>) to collect anonymized,
            aggregate usage data — such as page views and general traffic patterns. This does
            not involve cross-site ad tracking, third-party ad networks, or ad-targeting cookies.
          </p>

          <h3 className="mt-4 font-medium">Cookies</h3>
          <p className="mt-2">
            We use only first-party session cookies required for authentication (your Supabase
            auth session). We do not use third-party advertising or tracking cookies.
          </p>

          <h3 className="mt-4 font-medium">Payment information</h3>
          <p className="mt-2">
            Project Vaal is entirely free. There are no purchases anywhere in the app, and we do
            not collect any payment information.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            How We Use Your Information
          </h2>
          <p className="mt-2">We use the information described above to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>authenticate you and maintain your account and sign-in session;</li>
            <li>
              save and display your builds, campaign progress, and league preference across
              sessions and devices;
            </li>
            <li>
              retrieve your data from GGG&rsquo;s services on your behalf, if you&rsquo;ve
              connected a GGG account; and
            </li>
            <li>
              understand aggregate usage of the app so we can maintain and improve it (via
              anonymized analytics).
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            Who We Share Data With
          </h2>
          <p className="mt-2">
            We do not sell your data to any third party, ever. We do not use advertising networks
            or data brokers. We share data only with the service providers necessary to run
            Project Vaal:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              <strong>Supabase</strong> — our database hosting and authentication provider.
              Supabase stores all account data and user-generated content described above.
            </li>
            <li>
              <strong>Vercel</strong> — our application hosting provider, and the provider of the
              anonymous analytics described above.
            </li>
            <li>
              <strong>Google</strong> — only if you choose &ldquo;Sign in with Google,&rdquo; for
              the standard OAuth identity exchange. No other data is shared with Google.
            </li>
            <li>
              <strong>poe2scout.com</strong> — a third-party source of public PoE2 market-price
              data that Project Vaal reads <em>from</em>. No user data is ever sent to
              poe2scout.com; this is one-way ingestion of public price data, not a data-sharing
              relationship.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold tracking-tight">Your Rights</h2>
          <p className="mt-2">
            You can request a copy of your account data, or request that it be deleted, by
            contacting us at{' '}
            <Link
              href="mailto:[CONTACT EMAIL]"
              className="text-primary underline-offset-4 hover:underline"
            >
              [CONTACT EMAIL]
            </Link>
            . You can also ask us to correct inaccurate account data the same way.
          </p>
          <p className="mt-2 text-muted-foreground">
            Note: Project Vaal does not currently have a self-serve &ldquo;delete my
            account&rdquo; or &ldquo;download my data&rdquo; button in the app. Access, correction,
            and deletion requests are handled manually today, by contacting us directly.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold tracking-tight">Data Retention</h2>
          <p className="mt-2">
            We retain your account data until you request deletion, or until your account is
            removed for a Terms of Service violation.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            Children&rsquo;s Privacy
          </h2>
          <p className="mt-2">
            Project Vaal is not directed at children under 13, and we do not knowingly collect
            information from children under 13. If you believe a child under 13 has provided us
            information, please contact us at [CONTACT EMAIL] so we can address it.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold tracking-tight">Security</h2>
          <p className="mt-2">
            We use reasonable technical measures to protect your data, including encrypting
            sensitive tokens (such as GGG OAuth tokens) at rest and using row-level security on
            our database. That said, no method of storing or transmitting data is 100% secure,
            and we cannot guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            International Users &amp; Governing Law
          </h2>
          <p className="mt-2">
            Project Vaal is operated from, and this policy is written for, an operator based in
            the State of Texas, USA. Your data is processed and stored on infrastructure located
            in the United States (via Supabase and Vercel). This Privacy Policy is governed by
            the laws of the State of Texas.
          </p>
          <p className="mt-2">
            As a general matter, Texas residents may have additional statutory rights regarding
            their personal data under the Texas Data Privacy and Security Act (TDPSA, effective
            July 2024), which addresses rights such as access, correction, and deletion of
            personal data. The TDPSA has revenue and data-volume thresholds that determine which
            businesses it applies to; [OPERATOR NAME] should confirm with counsel whether the
            TDPSA applies to this specific operation.
          </p>
          <p className="mt-2 text-muted-foreground">
            This template does not specifically address the General Data Protection Regulation
            (GDPR) or the rights of users in the European Union or United Kingdom. If Project
            Vaal expects EU or UK users, [OPERATOR NAME] should work with counsel to add
            appropriate GDPR-related disclosures before relying on this policy.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            Changes to This Policy
          </h2>
          <p className="mt-2">
            We may update this Privacy Policy from time to time. If we make changes, we will
            update the effective date at the top of this page. We encourage you to review this
            page periodically.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold tracking-tight">Contact Us</h2>
          <p className="mt-2">
            If you have questions about this Privacy Policy or want to exercise any of the
            rights described above, contact us at{' '}
            <Link
              href="mailto:[CONTACT EMAIL]"
              className="text-primary underline-offset-4 hover:underline"
            >
              [CONTACT EMAIL]
            </Link>
            .
          </p>
        </section>

        <p className="border-t border-border pt-6 text-xs text-muted-foreground">
          [OPERATOR NAME] · Effective date: [EFFECTIVE DATE] · See also our{' '}
          <Link href="/terms" className="underline-offset-4 hover:underline">
            Terms of Service
          </Link>
          .
        </p>
      </div>
    </main>
  )
}
