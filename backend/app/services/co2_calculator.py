"""
CO₂ Offset Calculator
======================
Maps verified eco-action categories to kg CO₂ equivalent offset estimates.

Sources / methodology:
  - Tree planting: ~21 kg CO₂/year absorbed (EPA avg seedling to sapling)
  - Composting 1kg food waste: ~0.5 kg CO₂ avoided (methane avoided in landfill)
  - Cycling 10km instead of driving: ~1.8 kg CO₂ avoided (avg car = 0.18 kg/km)
  - Solar panel installation: ~900 kg CO₂/year avoided (avg 3kW home system)
  - Plastic-free month: ~5 kg CO₂ avoided (production + disposal savings)
  - Reusable bag usage: ~0.1 kg CO₂ per trip (plastic bag lifecycle savings)

These are per-action estimates. Compound over streaks for portfolio totals.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

# Category → base kg CO₂ per verified action
# Ordered by impact magnitude for display purposes
CO2_RATES: dict[str, float] = {
    # High-impact (> 10 kg per action)
    "solar_installation":       900.0,  # per year avoided
    "ev_purchase":              2100.0, # lifetime vs ICE vehicle
    "tree_planting":            21.0,   # per tree per year
    "renewable_energy":         150.0,  # switching to 100% renewable annually
    "home_insulation":          300.0,  # retrofit, annual savings

    # Medium-impact (1–10 kg)
    "cycling_commute":          1.8,    # per 10km trip
    "public_transit":           0.9,    # per 10km vs car
    "vegetarian_meal":          1.5,    # per meal vs avg meat meal
    "vegan_meal":               2.0,    # per meal
    "food_waste_composting":    0.5,    # per kg food diverted from landfill
    "local_food_purchase":      0.8,    # per weekly shop (transport savings)
    "energy_efficient_appliance": 120.0, # per year for major appliance
    "led_lighting":             80.0,   # per year per home

    # Low-impact (< 1 kg per action)
    "reusable_bag":             0.1,
    "reusable_bottle":          0.08,
    "reusable_cup":             0.05,
    "plastic_free_day":         0.2,
    "recycling":                0.15,   # per recycling session
    "second_hand_purchase":     2.0,    # per item (clothing avg)
    "clothing_repair":          0.5,    # per repaired item

    # Community / Education
    "eco_education":            5.0,    # per workshop / talk (influence factor)
    "community_cleanup":        2.0,    # per cleanup session
    "petition_signed":          0.01,   # symbolic — minimal direct impact

    # Default for uncategorised eco actions
    "general_eco_action":       0.5,
}

# Human-readable labels for frontend display
CATEGORY_LABELS: dict[str, str] = {
    "solar_installation":       "Solar Installation",
    "ev_purchase":              "EV Purchase",
    "tree_planting":            "Tree Planting",
    "renewable_energy":         "Renewable Energy",
    "home_insulation":          "Home Insulation",
    "cycling_commute":          "Cycling Commute",
    "public_transit":           "Public Transit",
    "vegetarian_meal":          "Vegetarian Meal",
    "vegan_meal":               "Vegan Meal",
    "food_waste_composting":    "Food Composting",
    "local_food_purchase":      "Local Food",
    "energy_efficient_appliance": "Efficient Appliance",
    "led_lighting":             "LED Lighting",
    "reusable_bag":             "Reusable Bag",
    "reusable_bottle":          "Reusable Bottle",
    "reusable_cup":             "Reusable Cup",
    "plastic_free_day":         "Plastic-Free Day",
    "recycling":                "Recycling",
    "second_hand_purchase":     "Second-Hand Purchase",
    "clothing_repair":          "Clothing Repair",
    "eco_education":            "Eco Education",
    "community_cleanup":        "Community Cleanup",
    "petition_signed":          "Petition Signed",
    "general_eco_action":       "Eco Action",
}

# Category groupings for portfolio breakdown chart
CATEGORY_GROUPS: dict[str, list[str]] = {
    "Energy":     ["solar_installation", "renewable_energy", "home_insulation", "energy_efficient_appliance", "led_lighting"],
    "Transport":  ["ev_purchase", "cycling_commute", "public_transit"],
    "Food":       ["vegetarian_meal", "vegan_meal", "food_waste_composting", "local_food_purchase"],
    "Waste":      ["reusable_bag", "reusable_bottle", "reusable_cup", "plastic_free_day", "recycling", "clothing_repair"],
    "Nature":     ["tree_planting", "community_cleanup"],
    "Lifestyle":  ["second_hand_purchase", "eco_education", "petition_signed", "general_eco_action"],
}


@dataclass
class CO2Result:
    category: str
    category_label: str
    group: str
    kg_co2: float
    confidence_adjusted_kg: float  # multiplied by ML confidence score


def calculate_co2(
    category: str,
    confidence: float = 1.0,
    quantity: float = 1.0,
) -> CO2Result:
    """
    Calculate CO₂ offset for a single verified action.

    Args:
        category: Eco action category slug
        confidence: ML confidence score (0.0–1.0) for impact weighting
        quantity: Number of units (e.g. 5 trees, 3 meals). Defaults to 1.

    Returns:
        CO2Result with raw and confidence-adjusted kg CO₂
    """
    rate = CO2_RATES.get(category, CO2_RATES["general_eco_action"])
    kg_raw = rate * quantity
    # Confidence >= 0.8 = full credit (min threshold for eco verification)
    # Confidence below 0.8 shouldn't reach here but scale linearly if it does
    confidence_factor = min(confidence / 0.8, 1.0) if confidence < 0.8 else 1.0
    kg_adjusted = round(kg_raw * confidence_factor, 4)

    group = next(
        (g for g, cats in CATEGORY_GROUPS.items() if category in cats),
        "Lifestyle"
    )

    return CO2Result(
        category=category,
        category_label=CATEGORY_LABELS.get(category, category.replace("_", " ").title()),
        group=group,
        kg_co2=round(kg_raw, 4),
        confidence_adjusted_kg=kg_adjusted,
    )


def calculate_total_co2(
    actions: list[dict],
) -> dict:
    """
    Calculate total CO₂ offset across a list of verified actions.

    Args:
        actions: List of dicts with keys: category, confidence, quantity (optional)

    Returns:
        Dict with total_kg, by_group breakdown, by_category breakdown
    """
    total_kg = 0.0
    by_group: dict[str, float] = {}
    by_category: dict[str, float] = {}

    for action in actions:
        result = calculate_co2(
            category=action.get("category", "general_eco_action"),
            confidence=float(action.get("confidence", 1.0)),
            quantity=float(action.get("quantity", 1.0)),
        )
        total_kg += result.confidence_adjusted_kg
        by_group[result.group] = by_group.get(result.group, 0.0) + result.confidence_adjusted_kg
        by_category[result.category_label] = (
            by_category.get(result.category_label, 0.0) + result.confidence_adjusted_kg
        )

    # Round all values
    by_group = {k: round(v, 2) for k, v in sorted(by_group.items(), key=lambda x: -x[1])}
    by_category = {k: round(v, 2) for k, v in sorted(by_category.items(), key=lambda x: -x[1])}

    # Equivalent comparisons for portfolio display
    trees_equivalent = round(total_kg / 21.0, 1)
    car_km_equivalent = round(total_kg / 0.18, 0)
    flights_equivalent = round(total_kg / 255.0, 2)  # avg short-haul flight

    return {
        "total_kg_co2": round(total_kg, 2),
        "by_group": by_group,
        "by_category": by_category,
        "equivalents": {
            "trees_planted_year": trees_equivalent,
            "car_km_avoided": int(car_km_equivalent),
            "short_flights_avoided": flights_equivalent,
        },
    }
