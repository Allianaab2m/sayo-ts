// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// Served as a GitHub Pages project site, so every URL lives under /sayo-ts.
// Root-absolute links in frontmatter (hero actions) do not get the base; write it out there.
export default defineConfig({
  site: "https://allianaab2m.github.io",
  base: "/sayo-ts",
  integrations: [
    starlight({
      title: "sayo",
      description:
        "Write your data structures and your business logic. sayo turns them into a Web API.",
      // English lives at the root, Japanese under /ja/
      defaultLocale: "root",
      locales: {
        root: { label: "English", lang: "en" },
        ja: { label: "日本語", lang: "ja" },
      },
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/Allianaab2m/sayo-ts" },
      ],
      editLink: {
        baseUrl: "https://github.com/Allianaab2m/sayo-ts/edit/main/docs/",
      },
      sidebar: [
        { slug: "getting-started" },
        { slug: "principles" },
        {
          label: "Building blocks",
          translations: { ja: "構成要素" },
          items: [{ autogenerate: { directory: "guides" } }],
        },
        {
          label: "Reference",
          translations: { ja: "リファレンス" },
          items: [{ autogenerate: { directory: "reference" } }],
        },
      ],
    }),
  ],
});
