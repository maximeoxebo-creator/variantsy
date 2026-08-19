import type { MetaFunction } from "@remix-run/node";

/**
 * Politique de confidentialité — page PUBLIQUE.
 *
 * Obligatoire pour la fiche App Store : Shopify exige une URL accessible sans
 * authentification. Elle vit donc dans une route à part, hors du layout `app.`
 * qui impose la session marchand.
 *
 * Le contenu décrit ce que l'app stocke RÉELLEMENT, vérifié dans le schéma
 * Prisma et dans les scripts storefront. Ne pas l'enjoliver : c'est un
 * engagement, et un examinateur le compare au comportement observé.
 */

const EMAIL = "contact.zeppelin.studio@gmail.com";
const MAJ = "19 August 2026";

export const meta: MetaFunction = () => [
  { title: "Privacy — Variantsy" },
  {
    name: "description",
    content:
      "What Variantsy stores, where it is hosted, and how a merchant's data is deleted.",
  },
];

/* --- Charte reprise du site Zeppelin Studio ------------------------------ */
const C = {
  fond: "#F5F5F3",
  encre: "#17181C",
  texte: "#3D3E44",
  doux: "#85868D",
  trait: "rgba(23,24,28,.14)",
  carte: "rgba(255,255,255,.62)",
  ombre: "rgba(23,24,28,.05) 0 1px 2px, rgba(23,24,28,.06) 0 12px 32px",
  sans: '"DM Sans", -apple-system, system-ui, "Segoe UI", sans-serif',
  serif: 'Fraunces, Georgia, serif',
};

function Surtitre({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11.5,
        fontWeight: 500,
        letterSpacing: "1.61px",
        textTransform: "uppercase",
        color: C.doux,
        marginBottom: 18,
      }}
    >
      {children}
    </div>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: C.carte,
        border: `1px solid ${C.trait}`,
        borderRadius: 22,
        boxShadow: C.ombre,
        padding: "30px 32px",
        marginBottom: 18,
      }}
    >
      <h2
        style={{
          fontFamily: C.serif,
          fontWeight: 300,
          fontSize: 25,
          letterSpacing: "-.6px",
          color: C.encre,
          margin: "0 0 14px",
        }}
      >
        {titre}
      </h2>
      <div style={{ fontSize: 16, lineHeight: 1.68, color: C.texte }}>{children}</div>
    </section>
  );
}

export default function Privacy() {
  const lien = { color: C.encre, textDecoration: "underline", textUnderlineOffset: 3 };
  const liste = { margin: "12px 0 0", paddingLeft: 20 };

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500&family=Fraunces:opsz,wght@9..144,300&display=swap"
      />
      <main
        style={{
          background: C.fond,
          minHeight: "100vh",
          fontFamily: C.sans,
          color: C.texte,
          padding: "0 24px 96px",
        }}
      >
        <nav
          style={{
            display: "flex",
            gap: 30,
            justifyContent: "center",
            background: "rgba(255,255,255,.75)",
            borderRadius: "0 0 22px 22px",
            boxShadow: C.ombre,
            padding: "22px 34px",
            width: "fit-content",
            margin: "0 auto 64px",
            fontSize: 13,
            letterSpacing: "1.4px",
            textTransform: "uppercase",
          }}
        >
          <a href="https://zeppelin-studio.vercel.app" style={{ color: C.doux, textDecoration: "none" }}>
            Home
          </a>
          <a
            href="https://zeppelin-studio.vercel.app/support"
            style={{ color: C.doux, textDecoration: "none" }}
          >
            Contact
          </a>
          <span style={{ color: C.encre }}>Privacy</span>
        </nav>

        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <Surtitre>Privacy · Variantsy</Surtitre>
          <h1
            style={{
              fontFamily: C.serif,
              fontWeight: 300,
              fontSize: 44,
              lineHeight: 1.02,
              letterSpacing: "-1.54px",
              color: C.encre,
              margin: "0 0 22px",
            }}
          >
            What Variantsy stores,
            <br />
            and what it never does.
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.62, color: C.doux, margin: "0 0 44px" }}>
            Variantsy is a Shopify app published by Zeppelin Studio. It changes how product
            colors, images and titles are displayed. It does not need to know anything about
            the people who visit your store, and it is built so that it never does.
          </p>

          <Section titre="No customer data, at any point">
            <p>
              Variantsy holds no personal data about your customers. No names, no email
              addresses, no orders, no browsing history, no identifiers of any kind. The app
              never requests the permissions that would allow it to read them.
            </p>
            <p style={{ marginTop: 12 }}>
              On your storefront, the app writes one item to the visitor&rsquo;s{" "}
              <code>sessionStorage</code>: a short-lived copy of your display settings, so the
              same request is not repeated on every page. It is erased when the browser tab is
              closed. Variantsy sets no cookie, and runs no analytics or tracking script.
            </p>
          </Section>

          <Section titre="What the app stores about your store">
            <ul style={liste}>
              <li>Your store domain, used to identify which settings belong to you.</li>
              <li>
                Your display settings: swatch shape and size, selection style, title template,
                and the other choices made in the app.
              </li>
              <li>
                Your color library: the option names, values and colors you have defined, so
                swatches show the right shade.
              </li>
              <li>
                An access token issued by Shopify when you install the app. It is what allows
                the app to read your products, and it is revoked when you uninstall.
              </li>
            </ul>
          </Section>

          <Section titre="What the app reads from Shopify">
            <p>
              Variantsy reads your products, their options, variants and media, and the name of
              your published theme so it can offer a direct link to the theme editor. These are
              the only permissions requested, and they are shown to you at install time.
            </p>
            <p style={{ marginTop: 12 }}>
              Product data is read when needed and is not copied into the app&rsquo;s database.
            </p>
          </Section>

          <Section titre="Where it is hosted">
            <p>
              The application runs on Vercel in Paris, France. The database is hosted by Neon in
              Frankfurt, Germany. Both are within the European Union. No data is transferred to
              any other processor, and Variantsy sends nothing to third-party services.
            </p>
          </Section>

          <Section titre="How long it is kept, and how it is deleted">
            <p>
              When you uninstall the app, your session is destroyed immediately and the access
              token stops working. Your settings and color library are kept for a short period,
              so that reinstalling restores your configuration rather than starting from an
              empty screen.
            </p>
            <p style={{ marginTop: 12 }}>
              When Shopify asks us to erase a store — which it does after an uninstall, or on
              your request — everything belonging to that store is deleted: settings, color
              library and sessions. Variantsy implements Shopify&rsquo;s mandatory compliance
              webhooks, including <code>shop/redact</code>, <code>customers/redact</code> and{" "}
              <code>customers/data_request</code>. The two customer requests return nothing,
              because there is nothing to return.
            </p>
          </Section>

          <Section titre="Your rights">
            <p>
              You may ask at any time what is stored about your store, request a copy, ask for
              it to be corrected, or ask for it to be erased. Write to{" "}
              <a href={`mailto:${EMAIL}`} style={lien}>
                {EMAIL}
              </a>{" "}
              and you will have an answer within thirty days, usually much sooner.
            </p>
            <p style={{ marginTop: 12 }}>
              If this policy changes in a way that affects you, the date below changes and the
              new version is published here before it takes effect.
            </p>
          </Section>

          <Section titre="Contact">
            <p>
              Zeppelin Studio —{" "}
              <a href={`mailto:${EMAIL}`} style={lien}>
                {EMAIL}
              </a>
            </p>
          </Section>

          <p style={{ fontSize: 13, color: C.doux, marginTop: 30, letterSpacing: ".2px" }}>
            Last updated {MAJ}
          </p>
        </div>
      </main>
    </>
  );
}
