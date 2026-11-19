# Agent log

Add a dated entry each time you work with your AI coding agent, with the newest entry at the bottom. Each entry records what you asked the agent, what it produced, and what you checked or changed. Paste your key prompts in exactly as you typed them. Include at least one time the agent got something wrong, and how you caught it.

Agent used for every entry: Claude (Anthropic).

## 2026-11-18: Reading the assignment and planning the site

- **Asked:** "I have a Website Project in my BDI475 course due tomorrow evening. AI use is fully allowed and encouraged. I have saved a pdf of the instructions page posted on canvas within my BDI475 folder for you to view and understand the full rubric, scope, instructions, directions, resources, etc. required/suggested to complete the assignment. I haven't fully read through it so first breakdown exactly what this assignment is, what its asking for, and how we'll approach doing it. Then walk through the steps we'll take to complete it, and then let's begin on it. Ask me any and all questions you may have."
- **Agent produced:** A summary of the assignment, its 3-part rubric and the steps to finish it. It read the starter template's `AGENTS.md` and `docs/data_description_sheet.md`, profiled the data, and asked me four questions.
- **Checked or changed:** I made the four decisions. I would create the repository myself. The site would be a market explorer. The price rule would be $10,000 to $5,000,000. The site would stay general, since the Part 2 questions are not out yet. I then created this repository from the template, turned on GitHub Pages, ran the publish workflow and listed the site in the About section (setup steps 1 to 3).

## 2026-11-18: Building the market explorer

- **Asked:** "here's my repo link: https://github.com/aozdaryal/BDI475-Website-Project explain anything i have to do clearly and step-by-step once i should do it"
- **Agent produced:** `scripts/build_summary.py`, which writes `data/site_summary.json` from the CSV. For all campuses, each campus and each city, that file holds medians, price per square foot, days on market, the 12-month change, distance bands, quarterly prices, price ranges and sales by month. It also made the site itself (`index.html`, `assets/style.css`, `assets/app.js`, with Chart.js saved in `assets/vendor/`), filled in the README, added notes on the site to `AGENTS.md`, and opened a pull request.
- **Checked or changed:** The agent recomputed every market's sales count, median price, price per square foot, days on market and 12-month change a second way, with SQL on `data/college_town_home_sales.sqlite`, and all 30 matched. Its medians match the course's example too: Davis at $889,000 and Pittsboro at $876,985.50, which the site rounds to $876,986.
- **Where the agent got it wrong:** On its first screenshot of the page, the price histogram's axis labeled the $1,250,000 bar as "$1.3M", because the label rounded to one decimal place. That misstates the price range, so the label now reads "$1.25M". The same review caught two smaller problems: the median price ran into the edge of its box, and cities with no excluded sales showed "0 more fall outside the price rule".
