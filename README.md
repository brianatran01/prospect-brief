# Prospect Brief

Paste the Shopify stores you're prospecting. For each one, it finds the marketing tools in the site's public page code, rates the fit for OuterSignal against its published integrations, and lays out a pilot in OuterSignal's own setup steps. Then Claude writes a call-prep brief, and plain code checks every tool, price and stat in that brief against what the scan found.

It's the companion to [Persona Playbook](https://persona-playbook.vercel.app): this app finds and qualifies the store, and Persona Playbook writes what each persona receives once the store is a customer.

Unofficial concept built for OuterSignal's sales team. Not affiliated with OuterSignal or any store it's run on.

## Run it locally (about five minutes)

You need Node.js 20.9 or newer. Scanning works without any key. Writing a brief needs an Anthropic API key (the same one Persona Playbook uses is fine); each brief costs a few cents, and the app shows the exact figure.

```bash
npm install
cp .env.example .env.local   # then paste your key after ANTHROPIC_API_KEY=
npm run dev                  # then open http://localhost:3000
```

If Persona Playbook is already running on port 3000, Next.js picks the next free port and prints it.

Start with **Try an OuterSignal case-study brand**, which scans Gratsi. It appears in OuterSignal's case studies, so it's a good check that the scan finds what it should. If it misses a tool you can see in a site's code, add its script domain to `lib/signatures.ts`.

Other commands:

- `npm test` runs 44 tests for detection, fit rules, the pilot plan, the fact check, the store reader and the Claude request, with the network mocked, so it costs nothing.
- `npm run typecheck` checks types.
- `npm run build` makes a production build.

## Deploy to Vercel

1. Push this folder to a new GitHub repository.
2. In Vercel, choose Add New, then Project, and import the repository. Vercel detects Next.js on its own.
3. Under Environment Variables, add `ANTHROPIC_API_KEY` and `DEMO_ACCESS_CODE`. Type the names in capitals exactly as written; Vercel treats `Anthropic_API_Key` as a different variable.
4. Deploy. If you change a variable later, redeploy, because variables only apply to new deployments.

## How it works

| Step | Code | What happens |
| --- | --- | --- |
| Read the store | `lib/scan.ts`, `lib/fetch.ts` | Fetches the homepage and `/products.json` in parallel, re-checking every redirect so a site can't bounce the server into a private network. |
| Find the stack | `lib/detect.ts`, `lib/signatures.ts` | Matches script domains and config keys for nine tools and keeps the matching snippet as evidence. Confirms Shopify from the public catalog, Shopify response headers or theme code. |
| Rate the fit | `lib/fit.ts` | Rules anyone can read: Shopify is required, Klaviyo adds 3, each other OuterSignal integration adds 1, a different email platform subtracts 1. |
| Plan the pilot | `lib/plan.ts`, `lib/vendor.ts` | OuterSignal's published setup steps, adjusted to what the scan found, each linked to the page it comes from. |
| Write the brief | `lib/claude.ts`, `lib/prompt.ts` | One Claude call, with structured outputs so the reply always has the same shape. The server re-scans the store first instead of trusting data from the browser. |
| Fact-check it | `lib/grounding.ts` | Plain code checks tool names, prices, percentages, multipliers and length, and marks each one in the brief. |
| Show it | `app/` | A ranked table that fills in as scans finish, evidence for each tool, the pilot plan, the brief with green and red marks, and CSV and Markdown downloads. |

What the fact check enforces:

- The brief names a tool only if the scan found it. Questions may ask about other tools, and a sentence about a case-study brand may mention that brand's results.
- Every price is a catalog price or a price on the store's own site.
- Every percentage or multiplier comes from OuterSignal's published case studies or the store's own words.
- Each field stays within its word limit.

## Decisions worth explaining

- **Code scans, Claude writes.** Scanning 25 stores costs nothing and takes seconds. Claude only runs when someone asks for a brief.
- **Evidence for every detection.** Each tool comes with the snippet of page code that proves it, so a salesperson can check it before repeating it to a prospect.
- **The server re-scans before writing.** The fact check always runs against what the site actually serves, never against data sent from the browser.
- **One file for OuterSignal's facts.** Integrations, plan requirements, setup steps and case-study numbers live in `lib/vendor.ts` with their sources, so a pricing or integration change is one edit.
- **Polite by default.** Two public requests per store, four stores at a time, and a user agent that says what it is.
- **Safe exports.** Store names come from untrusted websites, so the CSV export defuses anything a spreadsheet would run as a formula.
- **Styled after OuterSignal, but clearly not OuterSignal.** It borrows the look of OuterSignal's own site (Inter, black and white, square buttons and cards, small uppercase labels, their green) and adds pink accents. It keeps its own name, uses no OuterSignal logo, and every page carries an "unofficial concept" banner, so nobody mistakes it for an official OuterSignal tool.

## Known limits

- Detection reads the homepage's code only. Tools that load later, through a tag manager or only on other pages, show as not found. Not found doesn't mean not used.
- The signatures are hand-written for nine tools. If a tool changes its script domain, `lib/signatures.ts` needs an update.
- Stores behind bot protection often answer with status 403 and can't be scanned.
- Public pages don't show customer counts or revenue, so the brief asks for them instead of guessing.
- The address check doesn't defend against DNS rebinding.

## Next steps

- Push the ranked list into a CRM as accounts, with the brief attached as a note.
- Add signatures for more tools as the sales team asks for them, such as Okendo, Judge.me, Skio or PostPilot.
- Scan a collection page and a product page too, for tools that only load there.
- Keep a test set of known stores, so a tool that changes its script domain shows up as a failing test instead of a missed detection.

## Configuration

| Variable | Default | What it does |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | required for briefs | Your Anthropic API key. Scanning works without it. |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` | Any Claude model ID. |
| `ANTHROPIC_EFFORT` | `medium` | `low` is fastest and cheapest; `high` is most thorough. |
| `DEMO_ACCESS_CODE` | off | When set, visitors must enter this code before the app scans a site or calls Claude. |
| `PRICE_INPUT_PER_MTOK`, `PRICE_OUTPUT_PER_MTOK` | Sonnet 5.5 and Opus 5.5 rates | Cost estimates in USD per million tokens, if you switch to another model. |

## Sources for the OuterSignal facts

- [OuterSignal on the Shopify App Store](https://apps.shopify.com/famous-tracker): integrations, plans and pricing.
- [OuterSignal + Klaviyo email personalization](https://www.outersignal.com/blog/outersignal-klaviyo-email-personalization.html): the Shopify plan requirement, persona splits in flows, and the Gratsi results.
- [Your first day in OuterSignal](https://docs.outersignal.com/en/articles/15545118-your-first-day-in-outersignal): the Klaviyo connection, Playbooks, backsearch and the 1,000-customer persona threshold.

Checked October 2026. If OuterSignal changes any of these, update `lib/vendor.ts`.

## Recording a two-minute demo

1. Paste about ten stores, including the two case-study brands, and scan them.
2. Walk through the ranked list: the pink bars show fit, and tools with a green dot are OuterSignal integrations.
3. Open the top store. Show the evidence for one tool, the source links in the pilot plan, and a watch-out if it has one.
4. Write the brief. While it runs, explain that the server re-scans the store first so the fact check can't be fooled.
5. Point to a green mark and, if there is one, a red one. End by downloading the CSV.
