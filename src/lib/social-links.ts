import type { ResolvedSiteSettings } from "./wix-cms";

export type SocialLinkName = "facebook" | "instagram" | "linkedin" | "x" | "mail";

export type SocialLink = {
  label: string;
  href: string;
  icon: SocialLinkName;
};

export function getSocialLinks(site: ResolvedSiteSettings): SocialLink[] {
  return [
    {
      label: "Facebook",
      href: site.facebookUrl,
      icon: "facebook",
    },
    {
      label: "Instagram",
      href: site.instagramUrl,
      icon: "instagram",
    },
  ].filter((link) => link.href.trim());
}
