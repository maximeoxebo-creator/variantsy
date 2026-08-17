import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { login } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }
  return { showForm: Boolean(login) };
};

export default function Index() {
  return (
    <main style={{ fontFamily: "Inter, system-ui, sans-serif", padding: "48px 24px", maxWidth: 560, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Variantsy</h1>
      <p style={{ color: "#616161", lineHeight: 1.6 }}>
        Plusieurs images par variante, titre produit dynamique et sélecteurs en swatches.
        Installez l&apos;app depuis le Shopify App Store pour commencer.
      </p>
      <form method="get" action="/auth/login" style={{ marginTop: 24 }}>
        <label htmlFor="shop" style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>
          Domaine de la boutique
        </label>
        <input
          id="shop"
          type="text"
          name="shop"
          placeholder="ma-boutique.myshopify.com"
          style={{ width: "100%", padding: "10px 12px", border: "1px solid #D9D9D9", borderRadius: 8 }}
        />
        <button
          type="submit"
          style={{
            marginTop: 12,
            padding: "10px 16px",
            borderRadius: 8,
            border: "none",
            background: "#111",
            color: "#fff",
            cursor: "pointer",
            // Reset du chrome natif — voir PIÈGE N°5 dans CLAUDE.md.
            WebkitAppearance: "none",
            appearance: "none",
            outline: "none",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          Se connecter
        </button>
      </form>
    </main>
  );
}
