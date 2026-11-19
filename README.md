# College-Town Home Sales Explorer

## What this site is for

An explorer for the College-town home sales dataset: 35,371 home sales near 11 university campuses, closed from March 2023 to March 2026. Pick a campus or one of the 18 cities and towns to see the median sale price, price per square foot, days on market, the 12-month change in median price, how price per square foot changes with distance from campus, quarterly prices, the spread of sale prices, and which months homes sell in. A sortable table compares every campus or city side by side.

It is written for anyone weighing the housing market in a college town: students and staff thinking about buying, and anyone comparing Champaign-Urbana with other campus markets.

## Live site

https://aozdaryal.github.io/BDI475-Website-Project/

Repository: https://github.com/aozdaryal/BDI475-Website-Project

## Data notes

- **Price rule.** Only sales from $10,000 to $5,000,000 are used. That leaves out 40 sales under $10,000 (one at $0) and 31 over $5,000,000 (up to $81,510,000), 71 of 35,442 rows. Every figure on the site uses the remaining 35,371 sales.
- **Medians.** Every price, size and time is a median, because prices are skewed.
- **Price per square foot** is sale price divided by `living_area_sqft`, only for homes with 300 sq ft or more recorded. 130 rows list less than that (127 list 0) and 376 list none.
- **Days on market** is `contract_date - list_date`, not `sale_date - list_date`. It is computed only for sales with both dates (28,028 kept sales). Blank dates are never treated as zero, so the figure describes listed homes. The share of sales with no list date is shown per market in the comparison table.
- **12-month price change** compares the median price of sales closed 2025-03-26 to 2026-03-25 with sales closed 2024-03-26 to 2025-03-25, and is shown only when both periods have at least 30 sales. It mixes changes in which homes sold with changes in prices, so it is not a repeat-sales index.
- **Distance to campus** uses `miles_to_campus`, the straight-line distance to the nearest campus landmark. Distance bands with fewer than 20 sales are not shown.
- **Quarterly prices** start in 2023 Q2 because sales begin on 2023-03-27. Quarters with fewer than 10 sales are not plotted. 2026 Q1 runs through 2026-03-25.
- **Sales by month** average the complete months from April 2023 to February 2026: March over 2 years, every other month over 3.
- **No deduplication.** `listing_id` is the key. Repeated street addresses are separate units, so no rows were removed.
- **`home_type` is not used** because it is unreliable.

### How to rebuild the data file

The site reads `data/site_summary.json`, which `scripts/build_summary.py` computes from `data/college_town_home_sales.csv`. To rebuild it, run this from the repository root (needs Python 3 with pandas):

```
python scripts/build_summary.py
```

## Tools we used

- Claude (Anthropic) as the AI coding agent: wrote the data script and the site, and checked every figure against a separate SQLite calculation.
- Python and pandas for the data script.
- Plain HTML, CSS and JavaScript, with [Chart.js](https://www.chartjs.org/) 4.6.1 (MIT license) saved in `assets/vendor/`.
- GitHub Pages for hosting.

## Citation

College-town home sales dataset, version 1.0 (2026). University of Illinois-Deloitte Foundation Center for Business Emerging Technologies. Data collected March 2026.
