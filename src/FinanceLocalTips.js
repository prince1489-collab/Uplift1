// Country/region-specific finance tips — injected into the Finance category
// alongside the global tips when the user's country matches the region.
// UK tips already live in LifeHackLibrary.js (tagged region: "UK").

export const COUNTRY_REGION = {
  "United Kingdom": "UK",
  "United States": "US",
  "Australia": "AU",
  "Canada": "CA",
  "India": "IN",
  "Germany": "EU",
  "France": "EU",
  "Spain": "EU",
  "Italy": "EU",
  "Netherlands": "EU",
  "Belgium": "EU",
  "Sweden": "EU",
  "Norway": "EU",
  "Denmark": "EU",
  "Finland": "EU",
  "Austria": "EU",
  "Portugal": "EU",
  "Poland": "EU",
  "Switzerland": "EU",
  "Ireland": "EU",
  "Czech Republic": "EU",
  "Hungary": "EU",
  "Romania": "EU",
  "Greece": "EU",
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
