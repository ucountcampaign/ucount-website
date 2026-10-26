# PHP attack and U COUNT performance investigation

Reviewed on October 26, 2026, in America/Denver. All clock times below use UTC or MDT. MDT is UTC minus six hours on these dates.

## Findings

PHP2Shell is a verified PHP security incident. AWS observed attempted exploitation before the public leaks and patch release. Cloudflare separately recorded attack traffic. These reports do not establish that all attempts worked or that all websites were vulnerable. [AWS threat research](https://aws.amazon.com/blogs/security/amazon-threat-intelligence-identifies-php2shell-exploitation-prior-to-public-disclosure-in-madpot/), [Cloudflare telemetry](https://blog.cloudflare.com/php-vulnerabilities-waf-protection/)

The U COUNT application in this repository uses Astro 6, Cloudflare Workers JavaScript, and Wix APIs. It has no identified PHP runtime. The two PHP runtime flaws therefore do not directly apply to this application. This conclusion covers the inspected repository, not Wix's private infrastructure or other systems on the account. See the local code evidence below.

The supplied screenshot readings show occasional slow requests, many asset responses with 4xx status, and little evidence of sustained broad slowdown. Some slow spikes overlap the disclosure period. Earlier spikes and an October 20 deployment prevent a causal conclusion. The evidence does not show that PHP2Shell compromised U COUNT or caused its slow requests.

## Verified event chronology

The table separates disclosure events from traffic observations. Date-only reports do not support an exact local-time conversion.

| UTC date and time | Denver date and time | Event and evidence |
| --- | --- | --- |
| October 17, clock time and zone unstated | Exact conversion unavailable | AWS dates a MadPot exploitation attempt to this day. The source was anonymization infrastructure. This predates the reported public leaks. [AWS](https://aws.amazon.com/blogs/security/amazon-threat-intelligence-identifies-php2shell-exploitation-prior-to-public-disclosure-in-madpot/) |
| October 20, about 15:00 | October 20, about 09:00 MDT | CVE IDs circulated without technical details. The leaked severity score was wrong. [PHP Foundation](https://thephp.foundation/blog/2026/10/21/todays-php-security-release-and-how-were-strengthening-php-security/) |
| October 20, 19:30 | October 20, 13:30 MDT | PHP published advance notice and moved the release forward from October 22 at 14:00 UTC to October 21 at 14:00 UTC. Both scheduled times were 08:00 MDT. [PHP Foundation](https://thephp.foundation/blog/2026/10/21/todays-php-security-release-and-how-were-strengthening-php-security/) |
| October 20, about 20:00 | October 20, about 14:00 MDT | Calif mistakenly published a demonstration video with limited technical details. Copies circulated after deletion. [PHP Foundation](https://thephp.foundation/blog/2026/10/21/todays-php-security-release-and-how-were-strengthening-php-security/) |
| October 20, about 23:00 | October 20, about 17:00 MDT | PHP began sharing mitigation advice with some infrastructure providers. The Foundation reports a possible leak of that advice, not a confirmed leak. [PHP Foundation](https://thephp.foundation/blog/2026/10/21/todays-php-security-release-and-how-were-strengthening-php-security/) |
| October 21, about 02:00 to 08:00 | October 20, about 20:00 to October 21, 02:00 MDT | AWS found public proof-of-concept material around 02:00 and additional MadPot exploitation attempts during this interval. AWS could not establish whether those attempts would succeed on real systems. [AWS](https://aws.amazon.com/blogs/security/amazon-threat-intelligence-identifies-php2shell-exploitation-prior-to-public-disclosure-in-madpot/) |
| October 21, 03:02 | October 20, 21:02 MDT | Cloudflare gives this exact start time for default protection on its free and paid WAF. [Cloudflare WAF report](https://blog.cloudflare.com/php-vulnerabilities-waf-protection/) |
| October 21, 07:41 | October 21, 01:41 MDT | The Foundation reports that Chainguard published fixed binary images before the embargo ended. This exposed the binary fix for study. [PHP Foundation](https://thephp.foundation/blog/2026/10/21/todays-php-security-release-and-how-were-strengthening-php-security/) |
| October 21, 08:36 | October 21, 02:36 MDT | F5 first observed PHP2Shell scanning in its sensors. This is F5's first observation, not the campaign's start. [F5 Labs telemetry](https://www.f5.com/labs/articles/php2shell-exploitation-attempts-observed) |
| October 21, 14:00 | October 21, 08:00 MDT | Coordinated disclosure and patch release. AWS then observed further proof-of-concept traffic against its sensors. [AWS](https://aws.amazon.com/blogs/security/amazon-threat-intelligence-identifies-php2shell-exploitation-prior-to-public-disclosure-in-madpot/) |

Cloudflare's post also says protection preceded disclosure by about nine hours. Its stated 03:02 UTC start and the 14:00 UTC release differ by 10 hours and 58 minutes. Use the exact reported timestamps, and retain this source inconsistency. [Cloudflare WAF report](https://blog.cloudflare.com/php-vulnerabilities-waf-protection/)

The PHP team had not identified functional public exploits at release. That statement describes its own review. It does not negate AWS's separate observation of attempts. Neither statement proves a successful intrusion. [PHP Foundation](https://thephp.foundation/blog/2026/10/21/todays-php-security-release-and-how-were-strengthening-php-security/)

## What the attack evidence establishes

Use these terms separately:

- Disclosure or leak means information became public. It is not a traffic measurement.
- Scanning or probing means requests sought targets or tested behavior. A request for `wp-login.php` alone does not identify PHP2Shell.
- Attempted exploitation means a request tried to trigger the flaw. A matching WAF rule does not prove execution.
- Confirmed compromise requires evidence of an unauthorized result, such as code execution, data access, or a malicious change.

Cloudflare's first-party report confirms attack traffic and changing payloads that tried to bypass its rules. Its full transaction detection uses both requests and responses. These observations support real attack activity, but do not identify U COUNT as a victim. [Cloudflare WAF report](https://blog.cloudflare.com/php-vulnerabilities-waf-protection/), [full transaction detection](https://blog.cloudflare.com/full-transaction-waf/)

The original researchers demonstrated exploitability in controlled tests. Calif records a private report on August 11, a shared exploit on August 14, and PHP confirmation on August 15. Wiz records an August 24 private report and remote code execution demonstrations against WordPress, Drupal, and Joomla. These tests are distinct from attacker compromise of public sites. [Calif original research](https://calif.io/php2shell/), [Wiz original research](https://www.wiz.io/blog/php2shell-php-rce)

Retrieval of [Matthew Prince's original post](https://x.com/eastdakota/status/2113079352682570051) failed in this review. Its numerical attack counts and publication time remain unverified here. This investigation uses the accessible Cloudflare and AWS reports for attack evidence.

## Vulnerability scope and status on October 26

The official advisories rate both flaws 9.2 under CVSS v4.0:

- CVE-2026-109618 concerns memory corruption after an out-of-memory failure interrupts partially initialized request data. The advisory confirms remote code execution on Apache mod_php before application code runs. Exploit reliability depends on the build and deployment. [Official OOM advisory](https://github.com/php/php-src/security/advisories/GHSA-w8hw-w9fx-j79w)
- CVE-2026-109619 concerns stale request state that a later request can use after its memory is freed. The advisory confirms remote code execution paths on mod_php and PHP-FPM. [Official stale-state advisory](https://github.com/php/php-src/security/advisories/GHSA-6wmf-4rv5-p3rp)

PHP identifies PHP installations serving web requests as at risk. The October 21 fixes are PHP 8.2.35, 8.3.36, 8.4.27, and 8.5.12. Older branches require a supported vendor fix or migration. This is a PHP runtime problem, not a vulnerability in every website or every language. [PHP security announcement](https://www.php.net/archive/2026.php#2026-10-21-5)

On October 23, PHP disclosed a related issue, CVE-2026-115560. It requires upload progress plus an unusual configuration that changes the session serializer from `php_binary` or `php_serialize` to `php` at runtime. PHP recommends disabling `session.upload_progress.enabled` pending its next regular fix. The issue can affect the October 21 patched releases. Cloudflare states that its known-attempt protection depends on the default upload progress field name. [PHP follow-up advisory](https://www.php.net/archive/2026.php#2026-10-23-1), [Cloudflare update](https://blog.cloudflare.com/php-vulnerabilities-waf-protection/)

On October 26, PHP also announced Windows package rebuilds for the separate Brotli issue CVE-2026-111497. Neither follow-up establishes PHP exposure in this JavaScript Worker. [PHP Windows announcement](https://www.php.net/archive/2026.php#2026-10-26-1)

## Local code evidence

The code observations below describe commit `992707c` on `main`, before the parent's implementation changes. This snapshot does not prove which files or settings production currently runs. Greptile's available Knowledge Bases did not include `ucountcampaign/ucount-website`, so this review used local source.

| Evidence | What it establishes |
| --- | --- |
| [package.json](../package.json), [astro.config.mjs](../astro.config.mjs), [runtime-env.ts](../src/lib/runtime-env.ts) | Astro 6.4.2 uses server output and the Cloudflare adapter. Runtime configuration imports `cloudflare:workers`. The inspected source has no PHP files or configured PHP interpreter. |
| [index.astro](../src/pages/index.astro), [shop.astro](../src/pages/shop.astro) | Page rendering awaits Wix CMS and store results. Parallel requests still wait for the slowest required result. |
| [product detail page](../src/pages/product-page/%5Bslug%5D.astro), [wix-store.ts](../src/lib/wix-store.ts) | A missing product slug can trigger a Wix product query and collection query before the page sets status 404. The page also requests site settings. Unique unknown slugs bypass reuse of a previous slug's cache entry. |
| [event detail page](../src/pages/event-details/%5Bslug%5D.astro), [wix-events.ts](../src/lib/wix-events.ts) | An unknown event slug can trigger its Wix lookup plus shared event and CMS lookups before redirecting to `/events`. |
| [cache.ts](../src/lib/cache.ts), [wix-cms.ts](../src/lib/wix-cms.ts), [wix-store.ts](../src/lib/wix-store.ts), [wix-events.ts](../src/lib/wix-events.ts) | Module-level Maps cache results and pending promises for 60 seconds. These are local to a runtime instance. CMS retains a prior value for fallback after an error. Store and event caches remove rejected loads. No entry-count bound appears in these Maps. |
| [wix-events.ts](../src/lib/wix-events.ts), [wix-store.ts](../src/lib/wix-store.ts), [wix-contact.ts](../src/lib/wix-contact.ts) | The inspected direct Wix `fetch` calls have no explicit abort deadline. Wix SDK timeout behavior was not audited. |
| [contact API](../src/pages/api/contact.ts), [checkout API](../src/pages/api/checkout.ts) | Public POST handlers parse form data and can call Wix. Contact has a honeypot and required-field checks. These handlers do not show a local request-size or rate limit. Edge limits were not inspected. |
| [wrangler.jsonc](../wrangler.jsonc) | Local configuration enables persistent invocation logs and traces at full sampling. This does not prove that the deployed version has these settings or that historical records remain available. |

Inference: bots that reach valid dynamic routes with unique invalid slugs can create avoidable Wix work. Slow upstream calls can delay those responses without a CPU-limit error. The screenshots do not establish that this happened.

An arbitrary root path such as `/wp-login.php` does not match the product or event routes above. This source review did not establish that generic missing paths call Wix. Asset 4xx totals cannot identify which routing path ran. The presence of Wix APIs also does not establish that Wix uses vulnerable PHP or suffered this attack.

## What the performance screenshots support

These are approximate readings supplied with the task for October 12 through October 26. This review did not receive the raw exports, request logs, or original screenshot files. Counts from different charts may have different filters or version scopes.

| Reported observation | Supported reading and limit |
| --- | --- |
| About 46,200 Worker invocations | A volume total. It does not identify humans, bots, burst rate, routes, or attack type. |
| About 35,340 asset requests, about 32,000 with 4xx status | About 91% of this asset-request group returned client-error status. Bots requesting invalid paths are one explanation. Broken links or asset references are another. Do not add this total to invocations or assume all these requests executed page code. |
| Current version has two uncaught exceptions. All versions have 74 cancelled requests, with 47 on the current version and 27 on the earlier version | Small displayed counts do not identify their cause. Cancellation alone is not evidence of exploitation. Do not divide version-specific errors by an all-version request count. |
| Aggregate P50 about 90 ms, P90 about 600 ms, P99 about 1 s, P99.9 about 4 s | Most measured requests completed much faster than the extreme tail. These are percentiles, not averages. |
| Request-duration P99.9 has several 10 to 12 s spikes and an approximately 20 s peak after October 20, with earlier spikes too | Some intervals had slow tail requests. A time-bucket percentile can exceed the whole-period percentile. Without bucket counts, extreme percentiles can reflect very few requests. |
| Wall time has an approximately 900,000 ms outlier | This is 15 minutes of execution lifetime, not proof of a 15-minute response. Cloudflare wall time can include I/O and work after a response. Its cause needs a trace. [Metric definitions](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/) |
| CPU-limit and memory-limit errors are zero | No such limit failures appear in the reported scope. This does not exclude upstream delays or malformed traffic. |
| Browser RUM P75 is about 1.597 s for home and 1.465 s for shop. Events has insufficient data | The supplied RUM readings do not show a sustained broad slowdown. They do not rule out rare slow visits. The specific RUM metric, sample size, and comparison period still need confirmation. |
| Latest deployment is October 20 | A code or deployment change overlaps the leak period. Its effects must be separated from traffic changes. A Git commit timestamp is not the deployment timestamp. |

Cloudflare distinguishes invocation outcomes from HTTP status codes. A Worker can execute successfully and return a 404. Worker totals also exclude requests blocked before invocation by WAF. Neither successful invocation counts nor asset 4xx counts alone measure successful attacks. [Cloudflare metric definitions](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/)

## Timing assessment

The alignment is possible, but weak. October 20 and 21 include public leaks, observed probing, new protections, and patch release. They also overlap U COUNT's deployment. The supplied chart labels use MDT. Some October 21 UTC events occurred on October 20 in MDT, so the table above supplies local dates as well as UTC dates. A day-level spike still cannot establish a matching request or payload.

Earlier slow spikes prevent a claim that the public leak created all latency. AWS's October 17 observation also prevents a claim that attack attempts began only after the leak. Earlier U COUNT traffic could still be unrelated bot traffic or ordinary requests. No supplied request identifies a PHP2Shell payload.

The current evidence is consistent with occasional upstream waits and invalid traffic. That is an inference, not a diagnosis. It does not show steady broad deterioration or confirmed compromise. Request-level records are needed to distinguish bots, deployment effects, cache misses, Wix delay, and client cancellation.

## Useful mitigations for the parent to assess

These are recommendations only. This research changed no application code, deployed resources, Cloudflare rules, or Wix settings.

1. Preserve available October 12 to 26 logs and traces before retention removes them. Include October 17 and the earlier baseline. Obtain the actual October 20 deployment time and version ID.
2. Group traffic by hostname, normalized path, method, HTTP status, Worker outcome, and version. Compare request counts and latency in the same UTC intervals. Separate assets, normal pages, invalid dynamic slugs, and write APIs. Join WAF actions and Wix subrequest timing where available.
3. Identify actual invalid paths before proposing edge blocks. This JavaScript site can reject unused PHP and WordPress paths without querying Wix. Scope any rule to the intended hostname and known unused paths. PHP filename rules alone do not identify this campaign.
4. Reduce work on invalid dynamic routes. Check the requested product before loading its collections. Bound slug cache growth and negative-cache lifetime. Reuse shared catalog results where practical. Confirm actual cache hits instead of assuming a `Cache-Control` header guarantees them.
5. Give upstream reads a bounded wait and a defined fallback. Measure Wix time separately from rendering. Review write deadlines and retries separately, because checkout creation and contact submission can have side effects.
6. Review size and rate controls for `/api/contact` and `/api/checkout`. Reject unsupported methods and oversized or malformed forms before expensive processing. Base limits on legitimate use and preserve valid checkout and contact flows.
7. Verify actual WAF actions through an authorized read-only account review. Cloudflare says Free protection is automatic. Paid deployments should confirm block mode. This account's settings remain unknown. [Cloudflare deployment guidance](https://blog.cloudflare.com/php-vulnerabilities-waf-protection/)
8. If a separate PHP application is found, follow its vendor's current PHP patch guidance and restart its workers. The JavaScript application does not need a PHP upgrade. Configuration workarounds do not fully replace a PHP fix. [Official remediation](https://github.com/php/php-src/security/advisories/GHSA-w8hw-w9fx-j79w)

## Evidence still required

- Raw exports with bucket width, sample count, hostname, version, and filters. The supplied screenshots identify MDT but lack request-level records.
- Request paths, methods, statuses, timing, request IDs, and matched security rules for slow intervals and comparable normal intervals. User-Agent strings alone cannot establish identity or intent.
- Traces that show whether a slow request waited on Wix, form-body input, response streaming, or work after the response. Include cache state and sanitized upstream errors. Do not collect contact content, cookies, or API credentials for this comparison.
- Actual deployment history and the deployed code/configuration. The local snapshot is insufficient to assign a production regression.
- Provider status or support evidence before attributing any Wix delay to PHP2Shell. Evidence of an unauthorized result is required before describing compromise.

Campaign-related slowdown would gain support if matching exploit attempts reached this Worker, increased Wix work in the same intervals, and coincided with slower legitimate requests after controlling for version and cache state. Fast rejected probes with no Wix calls would weaken that explanation. The supplied aggregate charts cannot make this distinction.
