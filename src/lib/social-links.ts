import type { ResolvedSiteSettings } from "./wix-cms";

export type SocialLinkName = "facebook" | "instagram" | "linkedin" | "x" | "mail";

export type SocialLink = {
  label: string;
  href: string;
  icon: SocialLinkName;
};

// Builds the icon row shown in the footer and contact card. The newsletter
// signup form sits alongside the social profiles at the client's request.
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
    {
      label: "Newsletter signup",
      href: site.newsletterSignupUrl,
      icon: "mail",
    },
  ];

  return links.filter((link) => link.href.trim());
}
