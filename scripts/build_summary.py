"""Builds data/site_summary.json from data/college_town_home_sales.csv.

Run from the repository root:  python scripts/build_summary.py
"""
import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "data" / "college_town_home_sales.csv"
OUTPUT = ROOT / "data" / "site_summary.json"

PRICE_MIN = 10_000
PRICE_MAX = 5_000_000
SQFT_MIN = 300
DATA_END = pd.Timestamp("2026-03-25")
LAST_12 = (pd.Timestamp("2025-03-26"), DATA_END)
PRIOR_12 = (pd.Timestamp("2024-03-26"), pd.Timestamp("2025-03-25"))
MONTH_WINDOW = (pd.Timestamp("2023-04-01"), pd.Timestamp("2026-02-28"))
FIRST_QUARTER = "2023Q2"
HIST_STEP = 50_000
HIST_TOP = 1_500_000
BANDS = [(0, 1, "Under 1 mi"), (1, 2, "1–2 mi"), (2, 3, "2–3 mi"), (3, 5, "3–5 mi"), (5, 8, "5–8 mi"), (8, 16, "8+ mi")]
MIN_BAND = 20
MIN_QUARTER = 10
MIN_WINDOW = 30


def med(series):
    series = series.dropna()
    if len(series) == 0:
        return None
    return round(float(series.median()), 2)


def load():
    df = pd.read_csv(SOURCE, dtype={"zipcode": str, "county_fips": str, "parcel_number": str})
    df["list_date"] = pd.to_datetime(df["list_date"])
    df["contract_date"] = pd.to_datetime(df["contract_date"])
    df["sale_date"] = pd.to_datetime(df["sale_date"])
    df["place"] = df["city"] + ", " + df["state"]
    df["days_on_market"] = (df["contract_date"] - df["list_date"]).dt.days
    sqft = df["living_area_sqft"].where(df["living_area_sqft"] >= SQFT_MIN)
    df["price_per_sqft"] = df["sale_price"] / sqft
    return df


def summarize(all_rows, rows):
    total = len(all_rows)
    kept = rows
    n = len(kept)

    dom = kept["days_on_market"].dropna()
    last = kept[(kept["sale_date"] >= LAST_12[0]) & (kept["sale_date"] <= LAST_12[1])]["sale_price"]
    prior = kept[(kept["sale_date"] >= PRIOR_12[0]) & (kept["sale_date"] <= PRIOR_12[1])]["sale_price"]
    change = None
    if len(last) >= MIN_WINDOW and len(prior) >= MIN_WINDOW:
        change = round(float(last.median() / prior.median() - 1), 4)

    hist = []
    edges = list(range(0, HIST_TOP, HIST_STEP))
    for low in edges:
        count = int(((kept["sale_price"] >= low) & (kept["sale_price"] < low + HIST_STEP)).sum())
        hist.append({"low": low, "high": low + HIST_STEP, "count": count})
    hist.append({"low": HIST_TOP, "high": None, "count": int((kept["sale_price"] >= HIST_TOP).sum())})

    bands = []
    for low, high, label in BANDS:
        band = kept[(kept["miles_to_campus"] >= low) & (kept["miles_to_campus"] < high)]
        ppsf = band["price_per_sqft"].dropna()
        enough = len(band) >= MIN_BAND
        bands.append({
            "label": label,
            "sales": len(band),
            "median_price": med(band["sale_price"]) if enough else None,
            "median_ppsf": med(ppsf) if len(ppsf) >= MIN_BAND else None,
        })

    quarters = []
    by_quarter = kept.groupby(kept["sale_date"].dt.to_period("Q"))
    for period, group in by_quarter:
        if str(period) < FIRST_QUARTER:
            continue
        quarters.append({
            "quarter": f"{period.year} Q{period.quarter}",
            "sales": len(group),
            "median_price": med(group["sale_price"]) if len(group) >= MIN_QUARTER else None,
        })

    in_window = kept[(kept["sale_date"] >= MONTH_WINDOW[0]) & (kept["sale_date"] <= MONTH_WINDOW[1])]
    month_years = pd.period_range(MONTH_WINDOW[0], MONTH_WINDOW[1], freq="M")
    months = []
    for month in range(1, 13):
        years = sum(1 for p in month_years if p.month == month)
        count = int((in_window["sale_date"].dt.month == month).sum())
        months.append({"month": month, "sales": count, "years": years, "avg_sales": round(count / years, 1)})

    return {
        "rows": total,
        "sales": n,
        "excluded_by_price": total - n,
        "median_price": med(kept["sale_price"]),
        "p25_price": round(float(kept["sale_price"].quantile(0.25)), 2),
        "p75_price": round(float(kept["sale_price"].quantile(0.75)), 2),
        "mean_price": round(float(kept["sale_price"].mean()), 2),
        "median_ppsf": med(kept["price_per_sqft"]),
        "ppsf_sales": int(kept["price_per_sqft"].notna().sum()),
        "median_dom": med(dom),
        "dom_sales": len(dom),
        "no_list_date_share": round(float(kept["list_date"].isna().mean()), 4),
        "price_change_12m": change,
        "median_sqft": med(kept["living_area_sqft"].where(kept["living_area_sqft"] >= SQFT_MIN)),
        "median_year_built": med(kept["year_built"]),
        "median_beds": med(kept["beds"]),
        "median_miles": med(kept["miles_to_campus"]),
        "price_histogram": hist,
        "distance_bands": bands,
        "quarters": quarters,
        "months": months,
    }


def main():
    df = load()
    kept = df[(df["sale_price"] >= PRICE_MIN) & (df["sale_price"] <= PRICE_MAX)]

    scopes = []
    scopes.append({"id": "all", "kind": "all", "name": "All 11 campuses", "campus": None,
                   **summarize(df, kept)})

    for campus in sorted(df["university"].unique()):
        places = sorted(df[df["university"] == campus]["place"].unique())
        scopes.append({"id": "u:" + campus, "kind": "campus", "name": campus, "campus": campus, "places": places,
                       **summarize(df[df["university"] == campus], kept[kept["university"] == campus])})

    for place in sorted(df["place"].unique()):
        campus = df[df["place"] == place]["university"].mode()[0]
        scopes.append({"id": "c:" + place, "kind": "city", "name": place, "campus": campus,
                       **summarize(df[df["place"] == place], kept[kept["place"] == place])})

    summary = {
        "source": "data/college_town_home_sales.csv",
        "counts": {
            "rows": len(df),
            "kept": len(kept),
            "below_min": int((df["sale_price"] < PRICE_MIN).sum()),
            "above_max": int((df["sale_price"] > PRICE_MAX).sum()),
            "zero_price": int((df["sale_price"] == 0).sum()),
            "max_price": int(df["sale_price"].max()),
            "campuses": int(df["university"].nunique()),
            "cities": int(df["place"].nunique()),
            "states": int(df["state"].nunique()),
            "sqft_below_min": int((df["living_area_sqft"] < SQFT_MIN).sum()),
            "sqft_missing": int(df["living_area_sqft"].isna().sum()),
        },
        "rules": {
            "price_min": PRICE_MIN,
            "price_max": PRICE_MAX,
            "sqft_min": SQFT_MIN,
            "first_sale": df["sale_date"].min().strftime("%Y-%m-%d"),
            "last_sale": df["sale_date"].max().strftime("%Y-%m-%d"),
            "last_12": [d.strftime("%Y-%m-%d") for d in LAST_12],
            "prior_12": [d.strftime("%Y-%m-%d") for d in PRIOR_12],
            "month_window": [d.strftime("%Y-%m-%d") for d in MONTH_WINDOW],
            "min_band_sales": MIN_BAND,
            "min_quarter_sales": MIN_QUARTER,
            "min_window_sales": MIN_WINDOW,
        },
        "scopes": scopes,
    }
    OUTPUT.write_text(json.dumps(summary, indent=1))
    print(f"Wrote {OUTPUT.relative_to(ROOT)}: {len(scopes)} scopes, {len(kept):,} of {len(df):,} sales kept")


if __name__ == "__main__":
    main()
