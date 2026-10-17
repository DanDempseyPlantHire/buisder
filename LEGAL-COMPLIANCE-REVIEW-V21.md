# Buisder v21 — Production Legal & Compliance Review Notes

This release implements a compliance workspace and production-draft legal documents. It is not a substitute for legal advice or final legal sign-off.

## Source-backed design points

- GDPR transparency information should identify the controller, purposes, lawful bases, recipients/transfers, retention and data-subject rights. DPC: https://www.dataprotection.ie/en/organisations/know-your-obligations/transparency
- Article 30 GDPR requires a Record of Processing Activities. DPC: https://www.dataprotection.ie/en/dpc-guidance/records-of-processing-article-30-guidance
- Ireland's age of digital consent is 16 when consent is the legal basis for an information-society service. DPC: https://www.dataprotection.ie/sites/default/files/uploads/2023-04/DPC_ChildrensData_ParentalConsent.pdf
- The DPC Children's Fundamentals apply child-specific expectations to services directed at, intended for or likely to be accessed by children. DPC: https://www.dataprotection.ie/en/dpc-guidance/fundamentals-child-oriented-approach-data-processing
- A DPIA is relevant where processing may create high risk; automated decisions with significant effect, systematic monitoring and sensitive/vulnerable contexts are among the factors the DPC highlights. DPC: https://dataprotection.ie/en/organisations/know-your-obligations/data-protection-impact-assessments
- Personal-data breaches that present a risk must be notified to the DPC without undue delay and, where feasible, within 72 hours; even non-notified breaches must be internally recorded. DPC: https://www.dataprotection.ie/en/faqs/responsibilities-data-controllers/what-do-i-do-if-there-security-breach
- Non-exempt cookies/device storage generally require consent. Strictly necessary storage can be exempt, but clear information is still required. DPC: https://www.dataprotection.ie/en/dpc-guidance/guidance-cookies-and-other-tracking-technologies
- Under the DSA, hosting services must provide notice-and-action mechanisms for illegal content. European Commission / EUR-Lex: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022R2065
- The DSA also requires hosting services to provide statements of reasons for certain moderation restrictions; some additional online-platform obligations have micro/small-enterprise exceptions, so Buisder's exact classification and exemptions must be legally assessed. Commission overview: https://digital-strategy.ec.europa.eu/en/policies/dsa-brings-transparency
- The Commission published DSA minor-protection guidelines in July 2025. The Commission states that those guidelines apply to online platforms accessible to minors except micro and small enterprises. https://digital-strategy.ec.europa.eu/en/library/commission-publishes-guidelines-protection-minors

## Decisions still requiring qualified review

1. Confirm the legal entity operating Buisder and all public contact details.
2. Confirm whether Buisder is an intermediary/hosting service/online platform under the DSA and what SME exemptions apply.
3. Complete a DPIA covering 16–17-year-old users, job ranking, location and recruitment data.
4. Complete legitimate-interest assessments for security/moderation and first-party analytics if those bases are retained.
5. Approve the final Record of Processing Activities and lawful-basis map.
6. Review Cloudflare and Resend processor agreements, subprocessors and international transfer safeguards.
7. Approve a concrete retention/deletion schedule.
8. Confirm cookie/local-storage exemptions and whether a consent mechanism is needed.
9. Finalise DSA notice/action, moderation reasons and complaint/appeal requirements if applicable.
10. Finalise Terms wording on liability, governing law, consumer/business status and future paid plans.

## Product decisions already implemented

- Minimum job-seeker signup age is 16.
- Direct email, CV and profile-photo sharing is disabled by default for profiles marked 16–17.
- Matching is rule-based and orders jobs; it does not make employer hiring decisions.
- Data export, deletion, reporting/blocking and formal rights-request/complaint workflows are available.
- First-party analytics do not store IP addresses and detach user identity on account deletion.
- Security/account emails are separate from optional recruitment email preferences.
