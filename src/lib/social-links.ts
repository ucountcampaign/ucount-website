import type { ResolvedSiteSettings } from "./wix-cms";

export type SocialLinkName = "facebook" | "instagram" | "linkedin" | "x" | "mail";

export type SocialLink = {
  label: string;
  href: string;
  icon: SocialLinkName;
};

export function getSocialLinks(site: ResolvedSiteSettings): SocialLink[] {
  const links: SocialLink[] = [
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
  ];

  return links.filter((link) => link.href.trim());
}
