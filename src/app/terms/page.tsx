import Link from 'next/link'

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
      <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">
        &larr; Back to home
      </Link>

      <h1 className="font-heading mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
        Terms of Service
      </h1>

      <p className="mt-2 text-sm text-muted-foreground">Effective date: September 12, 2026</p>

      <div className="mt-6 rounded-xl border border-destructive/40 bg-destructive/10 p-4">
        <p className="text-sm font-medium text-destructive">
          This is a general template, not legal advice — have an attorney review before relying
          on it.
        </p>
      </div>

      <div className="mt-10 space-y-10 text-sm leading-relaxed text-foreground">
        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            1. Acceptance of terms
          </h2>
          <p>
            By accessing or using Project Vaal (the &quot;Service&quot;), you agree to be bound by
            these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, do not
            use the Service. The Service is operated by Jaycee McCullough.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            2. Description of the service
          </h2>
          <p>
            Project Vaal is a free, unofficial companion web application for Path of Exile 2
            (&quot;PoE2&quot;) players, built with console players especially in mind. It
            provides currency and item price checks, an interactive passive skill tree
            viewer/planner, a campaign checkpoint tracker, and a build planner/saver. Project Vaal
            is entirely free to use: there are no purchases, subscriptions, or payment processing
            of any kind anywhere in the app.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            3. No affiliation with Grinding Gear Games
          </h2>
          <p>
            Project Vaal is not affiliated with, endorsed by, or sponsored by Grinding Gear Games
            (&quot;GGG&quot;). &quot;Path of Exile&quot; and &quot;Path of Exile 2&quot; are
            trademarks of Grinding Gear Games. All game content, trademarks, and other
            intellectual property referenced or displayed in the Service belong to their
            respective owners.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold tracking-tight">4. Accounts</h2>
          <p>
            You may create an account using an email address and password, or by signing in with
            Google, via our authentication provider (Supabase Auth). You are responsible for
            maintaining the confidentiality of your account credentials and for all activity that
            occurs under your account. You may optionally link a Grinding Gear Games (GGG) account
            to the Service for the purpose of displaying your GGG account name; linking is
            optional and not required to use the Service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            5. User content and builds
          </h2>
          <p>
            The Service lets you save &quot;builds&quot; — passive skill tree selections,
            gear/gem loadouts, and an associated name, description, and notes — and mark each
            build as public or private. Public builds are visible to other users of the Service
            and may be viewed and liked by them. Private builds are visible only to you. You
            retain ownership of the content you submit, but you are solely responsible for it, and
            by marking a build public you grant other users the ability to view it within the
            Service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            6. No warranty on game data
          </h2>
          <p>
            Price data, passive skill tree data, campaign data, and other game-related information
            displayed by the Service may be inaccurate, delayed, or outdated. Currency and item
            price data syncs on an hourly basis from a third-party source (poe2scout.com) and is
            not guaranteed to be current. Path of Exile 2 is in active early access and subject to
            frequent balance changes, which may cause displayed data to fall out of date. The
            Service is provided on an &quot;as is&quot; and &quot;as available&quot; basis,
            without warranties of any kind, whether express or implied, including but not limited
            to warranties of accuracy, merchantability, fitness for a particular purpose, or
            non-infringement. Use of any information provided by the Service in connection with
            actual gameplay is at your own risk.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            7. Prohibited conduct
          </h2>
          <p>You agree not to:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Use the Service in any way that abuses, disrupts, or degrades it for other users;</li>
            <li>
              Scrape, crawl, or otherwise access the Service through automated means beyond normal,
              individual use, or attempt to circumvent rate limits or access controls;
            </li>
            <li>
              Attempt to gain unauthorized access to another user&apos;s account or to compromise
              the security of the Service;
            </li>
            <li>
              Submit build names, descriptions, or notes (the Service&apos;s only free-text user
              content) that are illegal, infringing, or otherwise violate the rights of others.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            8. Termination and account deletion
          </h2>
          <p>
            We may suspend or terminate your account if you violate these Terms. The Service does
            not currently have a self-serve delete-account feature. If you would like your account
            deleted, contact contact.projectvaal@gmail.com and we will process your request.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            9. Children&apos;s privacy
          </h2>
          <p>
            The Service is not directed at children under the age of 13, and we do not knowingly
            collect personal information from children under 13. If you believe a child under 13
            has provided us with personal information, please contact us at contact.projectvaal@gmail.com so we
            can address it.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            10. Privacy
          </h2>
          <p>
            Our collection and use of your information is described in our{' '}
            <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">
              Privacy Policy
            </Link>
            , which is incorporated into these Terms by reference.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            11. Governing law
          </h2>
          <p>
            These Terms are governed by the laws of the State of Texas, USA, without regard to its
            conflict-of-laws principles. You agree that any dispute arising from these Terms or
            the Service will be subject to the exclusive jurisdiction and venue of the state and
            federal courts located in Texas.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            12. Changes to these terms
          </h2>
          <p>
            We may update these Terms from time to time. If we make changes, we will update the
            effective date at the top of this page. Your continued use of the Service after any
            such change constitutes your acceptance of the revised Terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold tracking-tight">13. Contact</h2>
          <p>Questions about these Terms can be sent to contact.projectvaal@gmail.com.</p>
        </section>
      </div>
    </main>
  )
}
