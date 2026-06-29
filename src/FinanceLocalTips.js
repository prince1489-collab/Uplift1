// Country/region-specific finance tips — injected into the Finance category
// alongside the global tips when the user's country matches the region.
// UK tips already live in LifeHackLibrary.js (tagged region: "UK").

// Maps a user's country (profile.country, exact COUNTRY_OPTIONS string) to a finance region.
// Covers the top-50 GDP-per-capita countries; anything unmapped falls back to GLOBAL.
export const COUNTRY_REGION = {
  // ── Anglophone majors (own sets) ──
  "United Kingdom": "UK",
  "United States": "US",
  "Australia": "AU",
  "Canada": "CA",
  "New Zealand": "NZ",
  "India": "IN",
  // ── Switzerland (own set — pillar 3a etc.) ──
  "Switzerland": "CH",
  // ── Europe (shared EU/EEA set) ──
  "Germany": "EU", "France": "EU", "Spain": "EU", "Italy": "EU", "Netherlands": "EU",
  "Belgium": "EU", "Sweden": "EU", "Norway": "EU", "Denmark": "EU", "Finland": "EU",
  "Austria": "EU", "Portugal": "EU", "Poland": "EU", "Ireland": "EU", "Czech Republic": "EU",
  "Hungary": "EU", "Romania": "EU", "Greece": "EU", "Luxembourg": "EU", "Iceland": "EU",
  "San Marino": "EU", "Andorra": "EU", "Malta": "EU", "Slovenia": "EU", "Cyprus": "EU",
  "Estonia": "EU", "Lithuania": "EU", "Slovakia": "EU", "Latvia": "EU", "Croatia": "EU",
  "Liechtenstein": "EU", "Monaco": "EU",
  // ── Gulf (shared GCC set) ──
  "Qatar": "GCC", "United Arab Emirates": "GCC", "Kuwait": "GCC", "Saudi Arabia": "GCC",
  "Bahrain": "GCC", "Oman": "GCC",
  // ── East Asia (per-country sets) ──
  "Singapore": "SG",
  "Hong Kong": "HK",
  "Japan": "JP",
  "South Korea": "KR",
  "Taiwan": "TW",
  // ── Israel (own set) ──
  "Israel": "IL",
};

export const FINANCE_LOCAL = {

  // ─── United States ────────────────────────────────────────────────────────
  US: [
    {
      id: "us_fin_01", subArea: "Retirement", subAreaEmoji: "👵",
      title: "The 401(k) Free-Money Grab",
      hack: "Contribute at least enough to your 401(k) to capture every dollar of your employer's match — it's an immediate 50–100% return on that money before a single day of investment growth.",
      why: "Employer matches are the most powerful financial benefit most workers have. Not contributing enough to get the full match is leaving guaranteed free money on the table.",
    },
    {
      id: "us_fin_02", subArea: "Investing", subAreaEmoji: "📈",
      title: "The Roth IRA Window",
      hack: "If your income is below the Roth IRA limit ($161K single / $240K joint in 2024), open one and contribute the max ($7,000/year, or $8,000 if 50+). All growth and withdrawals in retirement are tax-free.",
      why: "Roth IRAs offer tax-free growth for decades; contributing now — especially when young — is one of the highest-leverage financial moves available to American earners.",
    },
    {
      id: "us_fin_03", subArea: "Tax", subAreaEmoji: "🧾",
      title: "The HSA Triple-Tax Advantage",
      hack: "If you have a high-deductible health plan, max out your Health Savings Account ($4,150 single / $8,300 family in 2024). Contributions are pre-tax, growth is tax-free, and withdrawals for medical expenses are tax-free.",
      why: "The HSA is the only account with three tax advantages simultaneously — it's better than a 401(k) or IRA for money that will be used on healthcare.",
    },
    {
      id: "us_fin_04", subArea: "Saving", subAreaEmoji: "🏦",
      title: "The High-Yield Savings Switch",
      hack: "Move your emergency fund to a High-Yield Savings Account (HYSA) at an online bank. Rates are typically 4–5% APY vs 0.01% at traditional banks — on $10K that's $400–500/year for doing nothing.",
      why: "Traditional bank savings accounts exist to make money for the bank, not for you. HYSAs at online banks pass interest back to customers because they have lower overhead.",
    },
    {
      id: "us_fin_05", subArea: "Credit", subAreaEmoji: "💳",
      title: "The FICO Optimisation Stack",
      hack: "To maximise your FICO score: pay every bill on time (35% of score), keep utilisation under 10% not just 30% (30% of score), keep old accounts open, and only apply for new credit every 6+ months.",
      why: "A 750+ FICO score can save you tens of thousands in mortgage interest over a lifetime — optimising it is one of the most financially impactful things an American can do.",
    },
    {
      id: "us_fin_06", subArea: "Student Loans", subAreaEmoji: "🎓",
      title: "The Income-Driven Repayment Enrolment",
      hack: "If your federal student loan payment exceeds 10% of your discretionary income, switch to an IDR plan (SAVE, PAYE, or IBR). Payments drop to 5–10% of income and any remaining balance is forgiven after 20–25 years.",
      why: "Millions of Americans overpay on student loans by staying on the Standard Repayment Plan; IDR plans legally cap your payment and can lead to forgiveness.",
    },
    {
      id: "us_fin_07", subArea: "Tax", subAreaEmoji: "🧾",
      title: "The Standard vs Itemised Deduction Check",
      hack: "Each year, check whether itemising deductions (mortgage interest, charitable gifts, state/local taxes up to $10K) beats the standard deduction ($14,600 single / $29,200 married in 2024). Use the higher one.",
      why: "Most Americans take the standard deduction, but homeowners with large mortgages or those who give significantly to charity often save more by itemising.",
    },
    {
      id: "us_fin_08", subArea: "Investing", subAreaEmoji: "📈",
      title: "The I-Bond Emergency Fund Bonus",
      hack: "Park up to $10,000/year in I-Bonds via TreasuryDirect.gov. They earn interest tied to inflation (recently 4–9% APY) and are backed by the US government. Only one-year lock-up before you can redeem.",
      why: "I-Bonds combine near-risk-free returns with inflation protection — ideal for the portion of your emergency fund that won't be needed for a year.",
    },
    {
      id: "us_fin_09", subArea: "Retirement", subAreaEmoji: "👵",
      title: "The Backdoor Roth Technique",
      hack: "If your income is too high for a direct Roth IRA contribution, contribute to a non-deductible Traditional IRA, then immediately convert it to a Roth. This 'backdoor' is legal and widely used.",
      why: "High earners can still access Roth tax-free growth through the backdoor; ignoring it means paying taxes on decades of investment returns unnecessarily.",
    },
    {
      id: "us_fin_10", subArea: "Tax", subAreaEmoji: "🧾",
      title: "The W-4 Withholding Tune",
      hack: "Review your W-4 after every life change (marriage, baby, second job). If you always get a big refund, you're over-withholding — adjust to get more in every paycheck instead of giving the IRS an interest-free loan.",
      why: "A $3,000 tax refund sounds nice, but it means you gave the government $250/month interest-free; adjusting withholding puts that money in your pocket each month instead.",
    },
  ],

  // ─── Australia ────────────────────────────────────────────────────────────
  AU: [
    {
      id: "au_fin_01", subArea: "Retirement", subAreaEmoji: "👵",
      title: "The Super Match Top-Up",
      hack: "If your employer pays Superannuation Guarantee (11% in 2024), check whether your fund offers co-contribution. Contribute an extra $1,000 post-tax and the government may add up to $500 if you earn under $58,445.",
      why: "The government co-contribution is essentially a 50% return before your super earns a cent — it's the single best return available to eligible Australian earners.",
    },
    {
      id: "au_fin_02", subArea: "Tax", subAreaEmoji: "🧾",
      title: "The Salary Sacrifice Power Move",
      hack: "Arrange with your employer to salary sacrifice into super above the SG minimum. Contributions are taxed at 15% instead of your marginal rate (up to 32.5%+), saving you thousands per year.",
      why: "The tax difference between your marginal rate and 15% super tax is essentially free money; the more you earn, the more you save by routing income through salary sacrifice.",
    },
    {
      id: "au_fin_03", subArea: "Investing", subAreaEmoji: "📈",
      title: "The Franking Credit Harvest",
      hack: "When investing in Australian shares, prioritise companies that pay fully franked dividends. The attached franking credits reduce your tax bill dollar-for-dollar — if you're in a low tax bracket, you may receive a cash refund.",
      why: "Franking credits are unique to Australia's dividend imputation system; ignoring them means leaving real cash on the table when you file your tax return.",
    },
    {
      id: "au_fin_04", subArea: "Saving", subAreaEmoji: "🏦",
      title: "The First Home Super Saver Scheme",
      hack: "If saving for a first home, contribute extra into super and then withdraw it (up to $50,000 total) under the FHSS Scheme. Contributions are taxed at 15% rather than your marginal rate.",
      why: "FHSS lets you save your house deposit inside super, cutting the tax you pay on that savings by up to 17.5 percentage points — a faster, tax-efficient path to your first home.",
    },
    {
      id: "au_fin_05", subArea: "Student Loans", subAreaEmoji: "🎓",
      title: "The HECS-HELP Repayment Threshold",
      hack: "HECS-HELP repayments kick in at $54,435 income (2024). Below that threshold, you owe nothing that year. Don't voluntarily repay HECS early unless your income is high — the debt is interest-free (CPI-indexed only).",
      why: "Unlike private loans, HECS grows only with inflation and can be written off if you die or become permanently disabled. There's rarely a financial reason to repay it faster than required.",
    },
    {
      id: "au_fin_06", subArea: "Investing", subAreaEmoji: "📈",
      title: "The CGT 50% Discount Rule",
      hack: "Hold any investment for over 12 months before selling. Australian tax law halves the capital gains tax on assets held longer than a year — effectively halving your rate on investment profits.",
      why: "The CGT discount is one of Australia's most powerful wealth-building rules; investors who sell too early pay double the tax unnecessarily.",
    },
    {
      id: "au_fin_07", subArea: "Debt", subAreaEmoji: "❄️",
      title: "The Mortgage Offset Account",
      hack: "If you have a mortgage, keep your savings in a linked offset account rather than a regular savings account. Every dollar in the offset reduces the interest you pay on your loan — tax-free and better than most savings rates.",
      why: "Offset accounts are legally brilliant: the interest 'saved' on your mortgage is tax-free income, whereas interest earned in a savings account is taxable — making offsets worth more than they appear.",
    },
    {
      id: "au_fin_08", subArea: "Tax", subAreaEmoji: "🧾",
      title: "The Work-From-Home Deduction",
      hack: "If you work from home, use the fixed-rate method (67 cents/hour) or actual-cost method to claim home office deductions. Keep a log of WFH hours and save utility bills to substantiate the claim.",
      why: "Unclaimed WFH deductions are among the most common ways Australians overpay tax; a proper claim can return $500–2,000 at tax time.",
    },
  ],

  // ─── Canada ───────────────────────────────────────────────────────────────
  CA: [
    {
      id: "ca_fin_01", subArea: "Saving", subAreaEmoji: "🏦",
      title: "The TFSA Contribution Room Tracker",
      hack: "Check your total available TFSA contribution room via CRA My Account. Every year since you turned 18 (and were a resident) adds new room — currently $7,000/year. Unused room carries forward forever.",
      why: "Many Canadians leave TFSA room unused and invest in taxable accounts instead, paying unnecessary capital gains and dividend tax on money that could grow tax-free.",
    },
    {
      id: "ca_fin_02", subArea: "Retirement", subAreaEmoji: "👵",
      title: "The RRSP vs TFSA Decision Tree",
      hack: "Contribute to your RRSP if you're in a high tax bracket now and expect to be in a lower one at retirement. Use a TFSA if you're in a low bracket now, or expect high income at retirement. When in doubt, max the TFSA first.",
      why: "Both accounts are excellent but serve different tax scenarios; choosing wrong means paying more tax over your lifetime on money that could have been sheltered.",
    },
    {
      id: "ca_fin_03", subArea: "Saving", subAreaEmoji: "🏦",
      title: "The First Home Savings Account",
      hack: "If you're a first-time buyer, open a First Home Savings Account (FHSA). You can contribute up to $8,000/year (lifetime $40,000), get a tax deduction like an RRSP, and withdraw it tax-free like a TFSA for your first home.",
      why: "The FHSA combines the best features of RRSP and TFSA specifically for first-time homebuyers — it's the most efficient savings vehicle Canada has ever created for this purpose.",
    },
    {
      id: "ca_fin_04", subArea: "Tax", subAreaEmoji: "🧾",
      title: "The GST/HST Credit Claim",
      hack: "File your tax return every year, even if you had zero income. The GST/HST credit (up to $496 per adult in 2024) is automatically assessed from your return — missing a year means missing the credit.",
      why: "Thousands of low-income Canadians miss the GST/HST credit simply by not filing a return; the credit is free money that requires only a return, not income.",
    },
    {
      id: "ca_fin_05", subArea: "Investing", subAreaEmoji: "📈",
      title: "The RESP Education Head Start",
      hack: "Open a Registered Education Savings Plan for a child. The government adds a 20% Canadian Education Savings Grant on the first $2,500/year ($500 free). Low-income families get additional grants.",
      why: "A 20% guaranteed return on the first $2,500 each year, plus tax-free growth, makes the RESP one of the best investments a Canadian parent can make for a child's future.",
    },
    {
      id: "ca_fin_06", subArea: "Tax", subAreaEmoji: "🧾",
      title: "The Work-From-Home Deduction",
      hack: "If you worked from home for more than 50% of a period of at least four consecutive weeks, you can deduct home office expenses. Use the flat-rate method ($2/day up to $500) for simplicity, or the detailed method for larger claims.",
      why: "Hundreds of thousands of Canadians miss this deduction each year; even the simplified flat-rate method returns money the CRA owes you after remote work.",
    },
    {
      id: "ca_fin_07", subArea: "Debt", subAreaEmoji: "❄️",
      title: "The Smith Manoeuvre Awareness",
      hack: "The Smith Manoeuvre converts non-deductible mortgage interest into tax-deductible investment loan interest. Re-borrow against your paid-down mortgage to invest; the interest becomes deductible. Requires planning with an accountant.",
      why: "Canadians can't deduct mortgage interest the way Americans can, but the Smith Manoeuvre legally creates a similar benefit — potentially saving tens of thousands in tax over a mortgage lifetime.",
    },
  ],

  // ─── India ────────────────────────────────────────────────────────────────
  IN: [
    {
      id: "in_fin_01", subArea: "Tax", subAreaEmoji: "🧾",
      title: "The 80C Full Utilisation List",
      hack: "Claim the full ₹1.5 lakh 80C deduction using PPF, ELSS, life insurance premium, home loan principal, or children's tuition. Many salaried employees only claim EPF and miss the full benefit.",
      why: "Section 80C is the largest deduction available to Indian taxpayers; leaving part of the ₹1.5 lakh unused is paying tax on income you could have legally sheltered.",
    },
    {
      id: "in_fin_02", subArea: "Saving", subAreaEmoji: "🏦",
      title: "The PPF Compound Lock-In Trick",
      hack: "Deposit into your Public Provident Fund (PPF) before the 5th of each month to earn interest for that month. A 15-year PPF at 7.1% tax-free grows ₹1.5L/year into roughly ₹40L+ — with zero tax on maturity.",
      why: "PPF offers guaranteed, tax-free, government-backed returns better than most FDs; the compounding over 15 years plus no tax on maturity makes it uniquely powerful.",
    },
    {
      id: "in_fin_03", subArea: "Retirement", subAreaEmoji: "👵",
      title: "The NPS Additional Deduction",
      hack: "Contribute up to ₹50,000 to the National Pension System (NPS) Tier I under Section 80CCD(1B) — this is over and above the ₹1.5L 80C limit. At 30% tax bracket, this saves ₹15,600 in tax.",
      why: "The NPS ₹50K deduction is an extra tax shield most salaried employees ignore; it's available only if you actively contribute, and the savings compound at market-linked returns.",
    },
    {
      id: "in_fin_04", subArea: "Tax", subAreaEmoji: "🧾",
      title: "The HRA Optimisation Check",
      hack: "If you pay rent, submit your rent receipts to your employer annually to maximise HRA exemption. The exempt amount is the lowest of: actual HRA received, 50% of basic (metro) or 40% (non-metro), or actual rent minus 10% of basic.",
      why: "HRA is one of the most valuable salary components for tax saving; not submitting rent receipts means paying tax on allowance you're legally entitled to exempt.",
    },
    {
      id: "in_fin_05", subArea: "Spending", subAreaEmoji: "⏳",
      title: "The UPI Cashback Stack",
      hack: "Stack UPI cashback offers: use PhonePe, Google Pay, or Paytm on days with cashback offers, and combine with bank-specific debit card offers. Many recharge and bill payments offer 10–20% cashback periodically.",
      why: "UPI cashback is real money returned instantly; stacking offers consistently saves ₹200–500/month on everyday transactions with no change in spending habits.",
    },
    {
      id: "in_fin_06", subArea: "Insurance", subAreaEmoji: "🛡️",
      title: "The PMJJBY + PMSBY Combo",
      hack: "Sign up for Pradhan Mantri Jeevan Jyoti Bima Yojana (PMJJBY) — ₹436/year for ₹2L life cover — and Pradhan Mantri Suraksha Bima Yojana (PMSBY) — ₹20/year for ₹2L accident cover. Both deduct automatically from your bank account.",
      why: "Together these give ₹4L of coverage for under ₹500/year — the most affordable insurance in India, and most people overlook them because they're government schemes.",
    },
    {
      id: "in_fin_07", subArea: "Salary", subAreaEmoji: "💼",
      title: "The EPF Voluntary Top-Up",
      hack: "You can voluntarily contribute above the mandatory 12% to EPF (up to 100% of basic). Additional contributions earn 8.25% tax-free and the accumulated corpus is tax-free on withdrawal after 5 years.",
      why: "EPF's guaranteed 8.25% tax-free return beats most fixed-income instruments; top-ups are also deductible under 80C, making them doubly efficient.",
    },
    {
      id: "in_fin_08", subArea: "Tax", subAreaEmoji: "🧾",
      title: "The New vs Old Tax Regime Check",
      hack: "Each year, calculate your tax under both the old regime (with deductions) and the new default regime (lower slabs, no deductions). If your 80C, HRA, home loan interest, and NPS deductions exceed ₹3.75L, the old regime usually wins.",
      why: "India now has two tax regimes and defaulting to the new one without checking can cost thousands; a 10-minute calculation every March can save a significant tax bill.",
    },
  ],

  // ─── Europe (generic) ─────────────────────────────────────────────────────
  EU: [
    {
      id: "eu_fin_01", subArea: "Retirement", subAreaEmoji: "👵",
      title: "The Three-Pillar Pension Check",
      hack: "European pension systems have three pillars: state pension (automatic), occupational pension (via employer), and private pension. Check what you're enrolled in at work — many employees don't realise they're not contributing to Pillar 2.",
      why: "In most EU countries, the state pension alone is insufficient for a comfortable retirement; understanding all three pillars early lets you fill gaps before it's too late.",
    },
    {
      id: "eu_fin_02", subArea: "Insurance", subAreaEmoji: "🛡️",
      title: "The European Health Insurance Card",
      hack: "Apply for a free European Health Insurance Card (EHIC) from your country's social security office. It gives you access to healthcare in all EU/EEA countries at local rates when travelling — making travel insurance redundant for medical emergencies within Europe.",
      why: "Many Europeans pay for travel insurance that duplicates EHIC coverage within the EU; using the free card instead saves €50–150 per trip.",
    },
    {
      id: "eu_fin_03", subArea: "Spending", subAreaEmoji: "⏳",
      title: "The SEPA Direct Debit Chargeback",
      hack: "Under EU law, you can dispute any SEPA direct debit up to 8 weeks after it's charged — no reason needed. For unauthorised debits, you have 13 months. Ask your bank to initiate a SEPA R-transaction.",
      why: "Many Europeans don't know SEPA chargeback rights exist; subscriptions and gym memberships that ignore cancellation requests can be reclaimed through your bank with no argument required.",
    },
    {
      id: "eu_fin_04", subArea: "Investing", subAreaEmoji: "📈",
      title: "The Low-Cost ETF Brokerage Switch",
      hack: "Open an account with a low-cost EU broker (DEGIRO, Trade Republic, or similar) and invest in a single global ETF (e.g., MSCI World or FTSE All-World). Total cost under 0.25%/year — better than any bank-sold fund.",
      why: "Most Europeans invest through bank-recommended funds with 1–2% annual fees; switching to low-cost ETFs via a discount broker saves thousands in fees compounding over decades.",
    },
    {
      id: "eu_fin_05", subArea: "Tax", subAreaEmoji: "🧾",
      title: "The EU Consumer Rights Money-Back Rule",
      hack: "Under EU law, you have a 14-day cooling-off period on any online purchase and a 2-year warranty on all goods. Use this confidently — merchants must refund you within 14 days of cancellation.",
      why: "Many Europeans don't assert their legal rights during returns and accept credit notes or restocking fees that are not legally required; knowing your rights saves money on every large purchase.",
    },
  ],

  // ─── Switzerland ──────────────────────────────────────────────────────────
  CH: [
    {
      id: "ch_fin_01", subArea: "Retirement", subAreaEmoji: "👵",
      title: "The Pillar 3a Tax Shield",
      hack: "Pay into a tied private pension (Pillar 3a) every year up to the annual maximum — the whole amount is deductible from your taxable income. Use a low-cost index-based 3a (e.g. VIAC/Frankly) rather than a cash 3a sitting at near-zero interest.",
      why: "3a is Switzerland's single best tax break: you cut income tax now and the money compounds in the market until retirement, instead of losing value as idle cash.",
    },
    {
      id: "ch_fin_02", subArea: "Retirement", subAreaEmoji: "👵",
      title: "The Staggered 3a Accounts Trick",
      hack: "Open several 3a accounts over the years rather than one big one, and withdraw them in different tax years near retirement. Lump-sum withdrawals are taxed progressively, so spreading them across years lowers the total tax.",
      why: "A single large 3a withdrawal is taxed at a higher rate; splitting it across multiple accounts and years keeps each lump in a lower bracket.",
    },
    {
      id: "ch_fin_03", subArea: "Insurance", subAreaEmoji: "🛡️",
      title: "The Health-Insurance Franchise Switch",
      hack: "Each autumn, compare basic health insurers on Priminfo and switch — the legally identical basic cover varies by hundreds of francs. If you're healthy, choose the highest franchise (deductible) to slash premiums.",
      why: "Basic Swiss health cover is identical by law, so a higher-franchise plan with a cheaper insurer is pure saving for anyone who rarely visits the doctor.",
    },
    {
      id: "ch_fin_04", subArea: "Retirement", subAreaEmoji: "👵",
      title: "The Pillar 2 Buy-In",
      hack: "Check your pension certificate for a voluntary buy-in (Einkauf) gap. Paying into your occupational pension (Pillar 2) is fully tax-deductible — most powerful in your highest-earning years before retirement.",
      why: "Buy-ins fill contribution gaps and reduce taxable income in big-earning years, turning a future pension top-up into an immediate tax saving.",
    },
    {
      id: "ch_fin_05", subArea: "Investing", subAreaEmoji: "📈",
      title: "The Low-Fee ETF Route",
      hack: "Switzerland has no ISA equivalent, so invest through a low-cost broker in a single global ETF rather than a bank fund. Capital gains on private investing are generally tax-free — but watch high bank fees and trading stamp duty.",
      why: "Bank-sold Swiss funds often charge 1–2% a year; a global ETF via a cheap broker captures tax-free private capital gains and compounds far more over time.",
    },
    {
      id: "ch_fin_06", subArea: "Tax", subAreaEmoji: "🧾",
      title: "The Ordinary-Assessment Claim",
      hack: "If you're taxed at source (Quellensteuer), you can file for ordinary assessment to claim deductions — 3a, pension buy-ins, commuting, childcare, further education. Above a certain income it's automatic.",
      why: "Tax-at-source uses flat averages and ignores your deductions; filing an ordinary return is how foreigners reclaim 3a and other reliefs they're entitled to.",
    },
    {
      id: "ch_fin_07", subArea: "Retirement", subAreaEmoji: "👵",
      title: "The AHV Gap Plug",
      hack: "Make sure you have no missing AHV (state pension) contribution years — gaps permanently cut your pension. If you spend a year not working or abroad, check whether to pay voluntary contributions to keep the record full.",
      why: "Each missing AHV year reduces your lifelong state pension; plugging gaps early is far cheaper than discovering them at retirement.",
    },
    {
      id: "ch_fin_08", subArea: "Tax", subAreaEmoji: "🧾",
      title: "The Canton Wealth-Tax Awareness",
      hack: "Switzerland taxes net wealth annually and rates vary hugely by canton and commune. Before a big move, compare the tax multiplier — relocating canton (or even commune) can materially cut both income and wealth tax.",
      why: "Cantonal tax competition is real money: the same salary and assets can be taxed very differently a few kilometres apart.",
    },
    {
      id: "ch_fin_09", subArea: "Spending", subAreaEmoji: "⏳",
      title: "The Half-Fare Travelcard Maths",
      hack: "If you take more than a handful of intercity train trips a year, the SBB Half Fare travelcard pays for itself by halving every ticket. Add a saver-day pass for longer trips booked ahead.",
      why: "Swiss rail is excellent but pricey at full fare; the Half Fare card turns occasional travel into consistent 50% savings.",
    },
  ],

  // ─── New Zealand ──────────────────────────────────────────────────────────
  NZ: [
    {
      id: "nz_fin_01", subArea: "Retirement", subAreaEmoji: "👵",
      title: "The KiwiSaver Free-Money Capture",
      hack: "Contribute at least enough to KiwiSaver to get your full employer contribution AND the annual government contribution (member tax credit). If you're young, switch out of the default conservative fund into a growth fund.",
      why: "The employer match plus government top-up is guaranteed return before any market growth; sitting in a default cash/conservative fund while young leaves decades of compounding on the table.",
    },
    {
      id: "nz_fin_02", subArea: "Investing", subAreaEmoji: "📈",
      title: "The No-CGT Long Hold",
      hack: "New Zealand has no broad capital gains tax, so long-term investing in NZ shares and global index funds is highly tax-efficient. Just stay under the FIF thresholds on large foreign holdings and hold for the long term.",
      why: "Without a general CGT, buy-and-hold investors keep their gains; frequent trading or being classed as a 'trader' is what creates a tax bill.",
    },
    {
      id: "nz_fin_03", subArea: "Tax", subAreaEmoji: "🧾",
      title: "The Correct PIR Check",
      hack: "Check that your Prescribed Investor Rate (PIR) on PIE funds (including KiwiSaver) is set correctly with your provider. An over-stated PIR overpays tax you often can't get back.",
      why: "PIE tax is final at your PIR; getting it wrong quietly costs you money every year, and an over-paid PIR is not always refundable.",
    },
    {
      id: "nz_fin_04", subArea: "Saving", subAreaEmoji: "🏦",
      title: "The First-Home KiwiSaver Withdrawal",
      hack: "First-home buyers can withdraw most of their KiwiSaver (above a small minimum) for a deposit after three years of membership. Check eligibility and the First Home Grant criteria early in your savings journey.",
      why: "Many first buyers don't realise how much of their KiwiSaver they can use for a deposit; knowing early lets you plan contributions around the purchase.",
    },
    {
      id: "nz_fin_05", subArea: "Insurance", subAreaEmoji: "🛡️",
      title: "The ACC Overlap Check",
      hack: "ACC covers you for accidents (not illness) regardless of fault. Before buying income-protection or accident insurance, check what ACC already provides so you don't pay twice for accident cover.",
      why: "ACC is a uniquely broad no-fault scheme; private policies that duplicate accident cover are a common, avoidable expense.",
    },
    {
      id: "nz_fin_06", subArea: "Debt", subAreaEmoji: "❄️",
      title: "The Offset / Revolving Mortgage",
      hack: "Use an offset or revolving-credit mortgage so your everyday savings sit against the loan and cut the interest you pay. Every dollar parked there saves mortgage-rate interest, tax-free.",
      why: "Interest 'saved' on your mortgage is effectively tax-free income and usually beats the after-tax return on a savings account.",
    },
    {
      id: "nz_fin_07", subArea: "Spending", subAreaEmoji: "⏳",
      title: "The Powerswitch Habit",
      hack: "Once a year, run your address through Powerswitch to compare electricity and gas plans. Switching providers is quick and frequently saves a few hundred dollars for the same supply.",
      why: "Energy retailers rely on inertia; an annual comparison reclaims the 'loyalty premium' loaded onto long-standing customers.",
    },
    {
      id: "nz_fin_08", subArea: "Saving", subAreaEmoji: "🏦",
      title: "The Working for Families Claim",
      hack: "If you have children, check your Working for Families tax-credit entitlement with IRD. Many families on modest incomes qualify and don't claim, or don't update their details after an income change.",
      why: "Working for Families is money you're entitled to but must claim; unclaimed or out-of-date entitlements are a quiet annual loss.",
    },
  ],

  // ─── Gulf / GCC (UAE, Qatar, Saudi, Kuwait, Bahrain, Oman) ─────────────────
  GCC: [
    {
      id: "gcc_fin_01", subArea: "Salary", subAreaEmoji: "💼",
      title: "The End-of-Service Gratuity Count",
      hack: "Know your end-of-service gratuity entitlement (days of basic salary per year of service) and treat it as part of your pay. Understand how resigning vs being terminated, and unlimited vs limited contracts, affect what you keep before you switch jobs.",
      why: "Gratuity is a major slice of total compensation in the Gulf; job moves timed or structured badly can forfeit thousands you've effectively already earned.",
    },
    {
      id: "gcc_fin_02", subArea: "Saving", subAreaEmoji: "🏦",
      title: "The No-Income-Tax Savings Rate",
      hack: "With no personal income tax, set an aggressive savings target — aim to bank a large share of every pay cheque. Lifestyle inflation, not low income, is what stops Gulf expats from building wealth.",
      why: "Tax-free salaries are a rare wealth-building window; capturing it depends entirely on saving the surplus before spending rises to match income.",
    },
    {
      id: "gcc_fin_03", subArea: "Retirement", subAreaEmoji: "👵",
      title: "The Self-Funded Pension",
      hack: "As an expat you usually get no state pension, so build your own: open a low-cost global index-fund portfolio early and automate monthly contributions. Don't wait for an employer scheme that isn't coming.",
      why: "No one is saving for your retirement in the Gulf but you; starting a simple ETF plan early replaces the pension your home country might have provided.",
    },
    {
      id: "gcc_fin_04", subArea: "Investing", subAreaEmoji: "📈",
      title: "The Offshore Savings-Plan Trap",
      hack: "Politely decline long-lock-in, insurance-linked 'savings' or 'investment' plans sold to expats by commission-based advisers. Their fees and surrender penalties are brutal — invest directly in low-cost ETFs instead.",
      why: "These plans can quietly consume years of returns in fees and trap your money with exit penalties; self-directed index investing keeps costs near zero.",
    },
    {
      id: "gcc_fin_05", subArea: "Spending", subAreaEmoji: "⏳",
      title: "The Remittance FX Timing",
      hack: "Compare transfer services (Wise, exchange houses, bank) before sending money home and watch the exchange rate on large remittances. A fraction of a percent in FX margin is real money on big transfers.",
      why: "Exchange houses and banks bake their profit into the rate, not just the fee; comparing and timing transfers can save meaningfully on every remittance.",
    },
    {
      id: "gcc_fin_06", subArea: "Saving", subAreaEmoji: "🏦",
      title: "The Visa-Risk Emergency Fund",
      hack: "Keep a larger emergency fund (6–12 months) than you would at home, because your residency is tied to your job. Losing your role can mean leaving the country on short notice.",
      why: "In the Gulf a job loss is also a visa loss; a deeper cash buffer covers relocation, final bills, and the gap before the next role or departure.",
    },
    {
      id: "gcc_fin_07", subArea: "Spending", subAreaEmoji: "⏳",
      title: "The 5% VAT & Rent-Cheque Play",
      hack: "Budget for 5% VAT on most purchases, and when renting, negotiate fewer up-front cheques and learn your city's rent-cap rules (e.g. Dubai's RERA index) so increases stay within the legal limit.",
      why: "VAT and lumpy rent cheques strain cash flow; knowing the rent-increase rules stops landlords overcharging at renewal.",
    },
    {
      id: "gcc_fin_08", subArea: "Insurance", subAreaEmoji: "🛡️",
      title: "The Zakat Sinking Fund",
      hack: "If zakat applies to you, calculate it on your qualifying wealth annually (commonly 2.5%) and set it aside monthly into a separate pot, rather than scrambling for a lump sum once a year.",
      why: "Treating zakat as a monthly sinking fund turns a stressful year-end obligation into a smooth, planned outflow you've already budgeted for.",
    },
  ],

  // ─── Singapore ────────────────────────────────────────────────────────────
  SG: [
    {
      id: "sg_fin_01", subArea: "Retirement", subAreaEmoji: "👵",
      title: "The CPF Top-Up Tax Relief",
      hack: "Top up your CPF Special Account (or a family member's) under the Retirement Sum Topping-Up scheme for tax relief and risk-free CPF interest. Cash top-ups within the cap reduce your taxable income.",
      why: "CPF top-ups earn government-guaranteed interest well above a bank account and cut your tax bill at the same time — a rare double win.",
    },
    {
      id: "sg_fin_02", subArea: "Tax", subAreaEmoji: "🧾",
      title: "The SRS Account Open-and-Invest",
      hack: "Open a Supplementary Retirement Scheme (SRS) account — contributions are tax-deductible. Crucially, invest the SRS money in funds or ETFs rather than leaving it as cash earning almost nothing.",
      why: "SRS cuts your tax now, but uninvested SRS cash barely grows; investing it is what turns the tax break into real retirement wealth.",
    },
    {
      id: "sg_fin_03", subArea: "Investing", subAreaEmoji: "📈",
      title: "The No-CGT Global ETF",
      hack: "Singapore has no capital gains tax, so build wealth with low-cost global ETFs and hold long term. Prefer Irish-domiciled ETFs to cut US dividend withholding tax from 30% to 15%.",
      why: "Tax-free gains plus a smarter fund domicile means more of your returns stay yours — the domicile choice alone saves on every dividend.",
    },
    {
      id: "sg_fin_04", subArea: "Saving", subAreaEmoji: "🏦",
      title: "The HDB Grant Check",
      hack: "First-time buyers should map out HDB grants and the HDB-loan vs bank-loan choice before committing. Don't over-leverage into private property when an HDB flat with grants may build wealth more safely.",
      why: "HDB grants are substantial free money for eligible first-timers; understanding the loan options early avoids costly financing mistakes.",
    },
    {
      id: "sg_fin_05", subArea: "Salary", subAreaEmoji: "💼",
      title: "The SkillsFuture Spend",
      hack: "Use your SkillsFuture credits for approved courses instead of paying out of pocket. Top-ups are added periodically — check your balance before enrolling in any upskilling.",
      why: "SkillsFuture credits are government money earmarked for your development; letting them sit unused is leaving free training on the table.",
    },
    {
      id: "sg_fin_06", subArea: "Spending", subAreaEmoji: "⏳",
      title: "The Vouchers & Rebates Claim",
      hack: "Claim the CDC vouchers and GST/U-Save rebates you're eligible for, and redeem them before they expire. They offset groceries, utilities, and heartland spending.",
      why: "These rebates are issued automatically but lapse if unredeemed; a quick check each cycle keeps real money from expiring.",
    },
    {
      id: "sg_fin_07", subArea: "Credit", subAreaEmoji: "💳",
      title: "The Miles / Cashback Routing",
      hack: "Route your fixed monthly spend (bills, groceries, transport) through the credit card that best matches it for miles or cashback, and always pay the statement in full. Match the card to your actual spending pattern.",
      why: "Singapore's reward cards are generous; aligning the right card to your spend earns hundreds a year at no extra cost — provided you never carry a balance.",
    },
    {
      id: "sg_fin_08", subArea: "Insurance", subAreaEmoji: "🛡️",
      title: "The Integrated Shield Right-Sizing",
      hack: "Review your Integrated Shield Plan and rider. Post-reform riders carry co-payments — pick a ward tier you'd actually use and avoid over-insuring for private hospital cover you don't need.",
      why: "Many Singaporeans over-buy private-ward IPs they'll never use; right-sizing the plan cuts premiums that rise steeply with age.",
    },
  ],

  // ─── Hong Kong ────────────────────────────────────────────────────────────
  HK: [
    {
      id: "hk_fin_01", subArea: "Retirement", subAreaEmoji: "👵",
      title: "The MPF Tax-Deductible TVC",
      hack: "Make Tax-deductible Voluntary Contributions (TVC) into your MPF for a salaries-tax deduction (a combined cap with qualifying annuities). It's an easy way to cut tax while building retirement savings.",
      why: "TVC is one of the few salaries-tax deductions available in Hong Kong; using it lowers your tax bill and grows your pension pot at once.",
    },
    {
      id: "hk_fin_02", subArea: "Retirement", subAreaEmoji: "👵",
      title: "The MPF Consolidate & De-Fee",
      hack: "Consolidate old MPF accounts from previous jobs and switch into low-fee index/tracker funds. High MPF fund fees quietly erode decades of returns.",
      why: "Scattered, high-fee MPF accounts cost you compounding; consolidating into cheap trackers can add a lot to your final balance.",
    },
    {
      id: "hk_fin_03", subArea: "Saving", subAreaEmoji: "🏦",
      title: "The Low-Tax Take-Home Bank",
      hack: "Hong Kong's low, capped salaries tax and no GST mean high take-home pay. Bank the difference straight into investments by automating a transfer on payday before lifestyle spending starts.",
      why: "A high take-home is only an advantage if you save it; automating investment on payday captures the low-tax windfall instead of spending it.",
    },
    {
      id: "hk_fin_04", subArea: "Investing", subAreaEmoji: "📈",
      title: "The No-CGT ETF Build",
      hack: "With no capital gains tax, invest long-term in low-cost global ETFs. Use Irish-domiciled funds to reduce US dividend withholding tax versus US-domiciled ones.",
      why: "Tax-free gains plus a lower-withholding fund domicile keeps more of your return compounding over the decades.",
    },
    {
      id: "hk_fin_05", subArea: "Tax", subAreaEmoji: "🧾",
      title: "The QDAP / VHIS Deduction",
      hack: "If you need the cover anyway, a Qualifying Deferred Annuity Policy (QDAP) and Voluntary Health Insurance Scheme (VHIS) policy both give salaries-tax deductions. Don't buy them purely for the deduction, though.",
      why: "QDAP and VHIS turn insurance you may already want into a tax saving; the key is needing the product first, then claiming the relief.",
    },
    {
      id: "hk_fin_06", subArea: "Tax", subAreaEmoji: "🧾",
      title: "The Provisional-Tax Buffer",
      hack: "Set aside cash for provisional salaries tax, which is billed ahead. If your income drops, apply to hold over the provisional tax so you're not overpaying on income you won't earn.",
      why: "Provisional tax catches people out because it's charged in advance; budgeting for it (and holding it over when income falls) avoids a cash crunch.",
    },
    {
      id: "hk_fin_07", subArea: "Spending", subAreaEmoji: "⏳",
      title: "The Octopus & Card Rebates",
      hack: "Use credit cards that rebate Octopus top-ups and online spend, and clear the balance monthly. Match one main card to your everyday spending for the best year-round rebate.",
      why: "Hong Kong card rebates are competitive; routing routine spend through the right card earns steady cashback as long as you never revolve a balance.",
    },
  ],

  // ─── Japan ────────────────────────────────────────────────────────────────
  JP: [
    {
      id: "jp_fin_01", subArea: "Investing", subAreaEmoji: "📈",
      title: "The New NISA Tax-Free Engine",
      hack: "Use the new (2024) NISA: its tsumitate and growth quotas let your investment gains grow completely tax-free for life. Automate a monthly purchase of a low-cost global index fund inside it.",
      why: "Normally Japan taxes investment gains around 20%; NISA removes that entirely, so filling it with a cheap index fund is the highest-leverage move for most savers.",
    },
    {
      id: "jp_fin_02", subArea: "Retirement", subAreaEmoji: "👵",
      title: "The iDeCo Deduction",
      hack: "Contribute to iDeCo for an immediate income- and resident-tax deduction. The money is locked until 60, but the tax saving lands every year you contribute.",
      why: "iDeCo deducts your full contribution from taxable income, so even before any growth you get a guaranteed return equal to your tax rate.",
    },
    {
      id: "jp_fin_03", subArea: "Tax", subAreaEmoji: "🧾",
      title: "The Furusato Nōzei Hack",
      hack: "Use furusato nōzei (hometown tax): donate to regional towns, receive local food and goods in return, and deduct almost the entire amount from your taxes via the one-stop system. You essentially pay tax you owe anyway and get gifts for it.",
      why: "Furusato nōzei redirects tax you'd pay regardless into donations that send you premium regional produce — close to free goods for a small handling fee.",
    },
    {
      id: "jp_fin_04", subArea: "Investing", subAreaEmoji: "📈",
      title: "The eMaxis Slim Low-Fee Pick",
      hack: "Inside NISA/iDeCo, choose ultra-low-fee index funds (eMaxis Slim-type) over high-fee bank-recommended funds. A fraction of a percent in annual fees compounds into a large gap over decades.",
      why: "Bank-pushed Japanese funds often carry heavy fees; low-cost index funds keep more of the market's return working for you.",
    },
    {
      id: "jp_fin_05", subArea: "Spending", subAreaEmoji: "⏳",
      title: "The Point-Economy Stack",
      hack: "Pick one ecosystem (Rakuten, PayPay, or d-point), run your everyday spend and one main credit card through it, and redeem points for real purchases. Pay the card in full each month.",
      why: "Japan's point economy is unusually rich; concentrating spend in one ecosystem turns routine purchases into meaningful annual rewards.",
    },
    {
      id: "jp_fin_06", subArea: "Spending", subAreaEmoji: "⏳",
      title: "The Fee-Free Bank Switch",
      hack: "Use a fee-free online bank (Sony, Rakuten, Shinsei) to avoid transfer (furikomi) and out-of-hours ATM charges that traditional banks levy on routine transactions.",
      why: "Legacy Japanese banks charge for transfers and after-hours ATM use; online banks waive these, saving small fees that add up every month.",
    },
    {
      id: "jp_fin_07", subArea: "Saving", subAreaEmoji: "🏦",
      title: "The Kakeibo Budget Journal",
      hack: "Run a kakeibo — the traditional Japanese household budget journal — sorting spending into needs, wants, culture, and unexpected. Review monthly to see exactly where money leaks.",
      why: "Kakeibo's mindful, written method consistently cuts impulse spending more than passive app-tracking by forcing a conscious record of each outflow.",
    },
    {
      id: "jp_fin_08", subArea: "Tax", subAreaEmoji: "🧾",
      title: "The Resident-Tax Lag Plan",
      hack: "Remember resident tax (juminzei) is billed about a year in arrears based on last year's income. Budget for it after a pay rise, and especially set money aside before leaving a job or the country.",
      why: "Many people are caught out by a resident-tax bill on income they no longer earn; planning for the one-year lag avoids a nasty surprise.",
    },
  ],

  // ─── South Korea ──────────────────────────────────────────────────────────
  KR: [
    {
      id: "kr_fin_01", subArea: "Investing", subAreaEmoji: "📈",
      title: "The Korean ISA Shelter",
      hack: "Open a Korean ISA for tax-advantaged investing — gains within the limits are tax-free or taxed at a low separate rate. At maturity, roll the proceeds into a pension account for an extra tax deduction.",
      why: "The ISA shelters investment gains that would otherwise be taxed, and the pension roll-over at the end stacks a second tax break on top.",
    },
    {
      id: "kr_fin_02", subArea: "Retirement", subAreaEmoji: "👵",
      title: "The Pension-Savings + IRP Deduction",
      hack: "Contribute to a pension-savings account (연금저축) plus an IRP up to the combined annual limit for a substantial year-end tax credit (세액공제). It's the biggest deduction most Korean employees can claim.",
      why: "These accounts hand back a fixed percentage of your contribution as a tax credit, so you earn a guaranteed return before the investments grow.",
    },
    {
      id: "kr_fin_03", subArea: "Tax", subAreaEmoji: "🧾",
      title: "The Year-End Settlement Spend Mix",
      hack: "For the year-end tax settlement (연말정산), push spending above the income threshold onto debit cards, cash receipts, traditional markets, and public transport — they deduct at a higher rate than credit cards.",
      why: "Once you pass the spending threshold, the deduction rate on debit/cash is higher than on credit cards, so the payment method you choose directly cuts your tax.",
    },
    {
      id: "kr_fin_04", subArea: "Saving", subAreaEmoji: "🏦",
      title: "The Jeonse Deposit Guarantee",
      hack: "If you rent on jeonse (a large lump-sum deposit), protect it with jeonse deposit-guarantee insurance (전세보증보험) against a landlord who can't return it. Verify the property's debt and registry before signing.",
      why: "A jeonse deposit can be your entire savings; guarantee insurance and proper due diligence prevent a landlord default from wiping you out.",
    },
    {
      id: "kr_fin_05", subArea: "Saving", subAreaEmoji: "🏦",
      title: "The Housing-Subscription Account",
      hack: "Keep a housing-subscription savings account (주택청약통장) funded — it builds eligibility and priority for subscribing to new-build apartments, a key route onto the property ladder.",
      why: "New-apartment subscriptions favour long-standing account holders; starting and feeding the account early preserves future buying eligibility.",
    },
    {
      id: "kr_fin_06", subArea: "Retirement", subAreaEmoji: "👵",
      title: "The National Pension Gap Check",
      hack: "Check your National Pension (국민연금) contribution record and consider voluntary contributions to fill gaps during study, unemployment, or time abroad.",
      why: "Missing contribution periods reduce your future pension; voluntary top-ups keep the record continuous and protect your entitlement.",
    },
    {
      id: "kr_fin_07", subArea: "Saving", subAreaEmoji: "🏦",
      title: "The CMA Cash Parking",
      hack: "Park spare cash in a CMA account that pays daily interest instead of a 0% checking account. It stays liquid for emergencies while earning something every day.",
      why: "A CMA turns idle balances into daily interest without locking the money up, beating a standard zero-interest current account.",
    },
  ],

  // ─── Taiwan ───────────────────────────────────────────────────────────────
  TW: [
    {
      id: "tw_fin_01", subArea: "Retirement", subAreaEmoji: "👵",
      title: "The Labor-Pension Voluntary 6%",
      hack: "Make voluntary employee contributions to your labor pension (up to 6% of salary) — they're deducted from your taxable income now and grow for retirement.",
      why: "The voluntary 6% both lowers this year's tax and builds your pension, making it one of the most efficient moves available to Taiwanese employees.",
    },
    {
      id: "tw_fin_02", subArea: "Insurance", subAreaEmoji: "🛡️",
      title: "The NHI-First Cover Check",
      hack: "Taiwan's National Health Insurance is low-cost and comprehensive. Before buying private medical insurance, check what NHI already covers so you only insure genuine gaps.",
      why: "NHI is broad and cheap; layering unnecessary private cover on top is a common, avoidable cost.",
    },
    {
      id: "tw_fin_03", subArea: "Investing", subAreaEmoji: "📈",
      title: "The Low-Fee Index ETF",
      hack: "Invest via popular low-fee Taiwan index ETFs (e.g. 0050 / 006208) or a global ETF, with automated monthly purchases. Keep fees minimal and hold for the long term.",
      why: "Cheap, diversified index ETFs capture market growth without the high fees of actively managed or bank-sold funds.",
    },
    {
      id: "tw_fin_04", subArea: "Tax", subAreaEmoji: "🧾",
      title: "The Dividend-Tax Method Choice",
      hack: "At filing, choose the better of the two dividend-tax methods — combined with an imputation credit, or a separate flat rate — based on your tax bracket. Lower earners usually prefer the combined method.",
      why: "Taiwan lets you pick the dividend-tax treatment; choosing the right one for your bracket can noticeably cut the tax on investment income.",
    },
    {
      id: "tw_fin_05", subArea: "Spending", subAreaEmoji: "⏳",
      title: "The Uniform-Invoice Lottery",
      hack: "Always take the uniform invoice (統一發票) with your purchases and check the bimonthly lottery numbers — receipts double as free lottery tickets with real cash prizes. Use the app to auto-check.",
      why: "The uniform-invoice lottery turns receipts you'd get anyway into a free chance at cash, while also creating a record of your spending.",
    },
    {
      id: "tw_fin_06", subArea: "Credit", subAreaEmoji: "💳",
      title: "The Cashback Card Match",
      hack: "Use a cashback credit card matched to your main spending categories and pay it in full monthly. Watch for foreign-transaction fees on overseas or online purchases.",
      why: "A well-matched cashback card returns money on spending you'd do anyway, as long as you never carry interest-bearing debt.",
    },
    {
      id: "tw_fin_07", subArea: "Saving", subAreaEmoji: "🏦",
      title: "The Preferential-Rate Savings",
      hack: "Use preferential regular-savings deposit schemes where you qualify (some are offered to younger savers or specific groups) — they pay materially more than an ordinary demand deposit.",
      why: "Preferential-rate schemes beat standard savings rates for eligible savers, boosting return on cash you'd hold anyway.",
    },
  ],

  // ─── Israel ───────────────────────────────────────────────────────────────
  IL: [
    {
      id: "il_fin_01", subArea: "Saving", subAreaEmoji: "🏦",
      title: "The Keren Hishtalmut Window",
      hack: "Contribute to a study fund (keren hishtalmut) if offered — it's tax-advantaged and, after about six years, can be withdrawn tax-free for any purpose. It's widely regarded as Israel's best savings vehicle.",
      why: "Keren hishtalmut combines tax-free growth with eventual unrestricted access, making it uniquely flexible and efficient among Israeli savings options.",
    },
    {
      id: "il_fin_02", subArea: "Retirement", subAreaEmoji: "👵",
      title: "The Pension-Fee Negotiation",
      hack: "Check the management fees (דמי ניהול) on your pension/provident funds and negotiate them down — they're negotiable and even a small reduction compounds into a large difference over a career.",
      why: "Default pension fees are often far above the best available; since fees compound against you for decades, cutting them is one of the highest-value calls you can make.",
    },
    {
      id: "il_fin_03", subArea: "Investing", subAreaEmoji: "📈",
      title: "The Investment-Track Switch",
      hack: "Make sure your tax-advantaged funds (pension, gemel, hishtalmut) sit in an appropriate stock/index investment track rather than the conservative default — especially when you're young.",
      why: "The default track is often too cautious; choosing a growth/index track inside the same tax-advantaged wrapper materially raises long-term returns.",
    },
    {
      id: "il_fin_04", subArea: "Retirement", subAreaEmoji: "👵",
      title: "The Lost-Funds Clearing House",
      hack: "Use the official pension clearing house ('Maslaka') and the Har HaBituach insurance system to find old or lost pension and insurance accounts, then consolidate them into low-fee funds.",
      why: "Israelis routinely accumulate forgotten funds across jobs; finding and consolidating them recovers money and cuts duplicated fees.",
    },
    {
      id: "il_fin_05", subArea: "Tax", subAreaEmoji: "🧾",
      title: "The Tax Credit-Points Claim",
      hack: "Claim every tax credit point (nekudot zikui) you're entitled to — for parents, working mothers, new immigrants (olim), academic degrees, and more. Many employees overpay by not filing for them.",
      why: "Each credit point directly reduces tax owed; unclaimed points are a straightforward annual overpayment that's often recoverable for prior years too.",
    },
    {
      id: "il_fin_06", subArea: "Investing", subAreaEmoji: "📈",
      title: "The Low-Cost ETF Route",
      hack: "Invest in global index funds/ETFs through a low-cost Israeli broker rather than high-fee bank products. Remember capital-gains tax applies to real (inflation-adjusted) gains.",
      why: "Bank investment products carry heavy fees; a cheap broker plus index ETFs keeps costs low, and the inflation adjustment softens the tax on real gains.",
    },
    {
      id: "il_fin_07", subArea: "Debt", subAreaEmoji: "❄️",
      title: "The Mortgage-Track Mix Care",
      hack: "When taking a mortgage, structure the mix of tracks carefully (prime, fixed, and CPI-linked). CPI-linked tracks can grow with inflation, so understand the risk before weighting toward them.",
      why: "Israeli mortgages blend several tracks, and CPI linkage can quietly inflate your balance; a deliberate mix controls risk and total cost.",
    },
    {
      id: "il_fin_08", subArea: "Tax", subAreaEmoji: "🧾",
      title: "The Olim Benefit Window",
      hack: "New immigrants (olim) receive significant tax benefits for several years, including on foreign income and assets. Map out and use these while you're still inside the eligibility window.",
      why: "The olim tax benefits are time-limited and generous; planning around them early captures relief that disappears once the window closes.",
    },
  ],

  // ─── Global fallback (replaces UK-only tips for users with no specific region) ──
  GLOBAL: [
    {
      id: "gl_fin_01", subArea: "Saving", subAreaEmoji: "🏦",
      title: "The Rental Deposit Paper Trail",
      hack: "Before handing over any rental deposit, photograph the entire property in good light, get a signed inventory from the landlord, and pay only by bank transfer. Keep all records for the duration of the tenancy plus 12 months.",
      why: "Deposit disputes worldwide follow the same pattern: lack of evidence. Timestamped photos and bank records remove that vulnerability and protect your money at the end of the tenancy.",
    },
    {
      id: "gl_fin_02", subArea: "Student Loans", subAreaEmoji: "🎓",
      title: "The Student Loan Full Picture Check",
      hack: "Once a year, log in to your student loan provider and check: current balance, interest rate, repayment threshold in your country, and projected pay-off date. Make sure automatic repayments are running correctly.",
      why: "Student loan balances grow silently when you're not watching; an annual check catches errors early and helps you make informed decisions about whether to overpay.",
    },
    {
      id: "gl_fin_03", subArea: "Investing", subAreaEmoji: "📈",
      title: "The Global Index Fund Default",
      hack: "If you're unsure where to invest, start with a single low-cost global index fund (tracking the MSCI World or equivalent in your country). Set up automatic monthly contributions and don't touch it for 10+ years.",
      why: "Global index funds capture the growth of the world's largest economies without requiring expertise. The simplest, most consistent approach outperforms the vast majority of active investors over time.",
    },
    {
      id: "gl_fin_04", subArea: "Tax", subAreaEmoji: "🧾",
      title: "The Annual Tax Return Habit",
      hack: "File your country's equivalent of a tax return every year, even if not required. Most countries offer deductions for charitable donations, work expenses, and professional development that people miss by not filing.",
      why: "Governments don't chase you to claim what you're owed; filing a return is the only way to recover tax you've overpaid or claim deductions you're entitled to.",
    },
    {
      id: "gl_fin_05", subArea: "Credit", subAreaEmoji: "💳",
      title: "The Credit Report Annual Check",
      hack: "Request your credit report from your country's main credit bureau (most offer one free report per year). Check for errors, unfamiliar accounts, and outdated negative entries. Dispute anything inaccurate in writing.",
      why: "Credit report errors are common worldwide and can silently block loans, mortgages, and even jobs. Checking annually is free and catches problems while there's still time to fix them.",
    },
    {
      id: "gl_fin_06", subArea: "Debt", subAreaEmoji: "❄️",
      title: "The High-Interest Debt Priority Rule",
      hack: "List all your debts by interest rate, highest first. Pay the minimum on all of them, then throw every extra pound/dollar/rupee at the highest-rate debt until it's gone. Then attack the next one.",
      why: "High-interest debt (credit cards, payday loans, personal loans) compounds faster than most investments grow; clearing it is the highest guaranteed return available to anyone in debt.",
    },
    {
      id: "gl_fin_07", subArea: "Insurance", subAreaEmoji: "🛡️",
      title: "The Annual Insurance Switch Reminder",
      hack: "Set a calendar reminder 45 days before each insurance policy renews. Get 3 quotes from competitors. Tell your current insurer you're leaving — they'll often match or beat the best quote.",
      why: "Insurance companies charge 'loyalty tax' to long-term customers; switching or threatening to switch typically saves 15–30% on premiums without changing your coverage.",
    },
    {
      id: "gl_fin_08", subArea: "Spending", subAreaEmoji: "⏳",
      title: "The Scarcity Pricing Red Flag",
      hack: "When a website shows 'Only 2 left!' or 'Offer ends in 10 minutes', open the page in incognito mode. In most cases the countdown resets or the stock restores — the scarcity is manufactured to force a fast decision.",
      why: "Artificial scarcity triggers FOMO-driven purchases you wouldn't make with a clear head; recognising the technique protects you from spending impulses engineered by the retailer.",
    },
  ],
};
