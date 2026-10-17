import math
import re
from typing import Any

WEIGHTS = {
    "product_fit": 0.30,
    "cost_efficiency": 0.20,
    "quality_evidence": 0.15,
    "proximity": 0.10,
    "seller_reliability": 0.10,
    "availability_delivery": 0.10,
    "warranty_returns": 0.05,
}

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1 - a)))

def norm(value: Any) -> str:
    if isinstance(value, bool):
        return str(value).lower()
    return re.sub(r"\s+", " ", str(value).strip().lower())

def spec_match(expected: Any, actual: Any) -> bool:
    # Numeric values compare exactly here; use normalized units in a production catalogue.
    if isinstance(expected, (int, float)) and not isinstance(expected, bool):
        try:
            return float(expected) == float(actual)
        except (TypeError, ValueError):
            return False
    return norm(expected) == norm(actual)

def score_product(product: dict, requirement: dict, seller: dict | None, distance_km: float) -> dict:
    qty = requirement["quantity"]
    total_cost = float(product["price"]) * qty
    shipping_estimate = float(product.get("shipping_estimate", 0))
    total_cost += shipping_estimate

    name_words = set(norm(requirement["product_name"]).split())
    product_words = set(norm(product["name"]).split())
    union = name_words | product_words
    text_similarity = len(name_words & product_words) / len(union) if union else 0.0
    category_score = 100 if norm(product["category"]) == norm(requirement["category"]) else 0
    specs = product.get("specifications", {})
    mandatory = requirement.get("mandatory_specs", {})
    preferred = requirement.get("preferred_specs", {})
    mandatory_mismatches = []
    missing_mandatory = []
    for key, expected in mandatory.items():
        actual_key = next((k for k in specs if norm(k) == norm(key)), None)
        if actual_key is None:
            missing_mandatory.append(key)
        elif not spec_match(expected, specs[actual_key]):
            mandatory_mismatches.append({"field": key, "expected": expected, "actual": specs[actual_key]})
    preferred_hits = 0
    for key, expected in preferred.items():
        actual_key = next((k for k in specs if norm(k) == norm(key)), None)
        if actual_key is not None and spec_match(expected, specs[actual_key]):
            preferred_hits += 1
    preferred_score = 100 if not preferred else 100 * preferred_hits / len(preferred)
    product_fit = min(100, text_similarity * 55 + category_score * 0.35 + preferred_score * 0.10)

    # Lower total cost gets a higher score relative to budget; without budget, use a conservative baseline.
    budget = requirement.get("max_budget")
    if budget:
        cost_efficiency = max(0, min(100, (1 - total_cost / budget) * 100 + 35))
    else:
        unit_price = float(product["price"])
        cost_efficiency = max(20, min(100, 100 - math.log10(max(unit_price, 1)) * 10))

    quality_evidence = float(product.get("quality_score", 50))
    # Avoid treating a seller with little history as inherently untrustworthy.
    seller_reliability = float(seller.get("reliability_score", 65)) if seller else 60.0
    proximity = max(0, min(100, 100 * (1 - distance_km / 100)))
    stock = int(product.get("stock", 0))
    availability_score = 70 if stock >= qty else max(0, 70 * stock / max(qty, 1))
    max_days = requirement.get("max_delivery_days")
    delivery_days = int(product.get("delivery_days", 7))
    if max_days is not None:
        availability_score = (availability_score * 0.55) + (100 if delivery_days <= max_days else 0) * 0.45
    warranty_returns = min(100, product.get("warranty_months", 0) * 10 + (20 if product.get("return_available") else 0))

    breakdown = {
        "product_fit": round(product_fit, 1),
        "cost_efficiency": round(cost_efficiency, 1),
        "quality_evidence": round(quality_evidence, 1),
        "proximity": round(proximity, 1),
        "seller_reliability": round(seller_reliability, 1),
        "availability_delivery": round(availability_score, 1),
        "warranty_returns": round(warranty_returns, 1),
    }
    final_score = sum(breakdown[k] * WEIGHTS[k] for k in WEIGHTS)
    return {
        "score": round(final_score, 1),
        "score_breakdown": breakdown,
        "distance_km": round(distance_km, 2),
        "total_cost": round(total_cost, 2),
        "mandatory_mismatches": mandatory_mismatches,
        "missing_mandatory": missing_mandatory,
        "exact_mandatory_match": not mandatory_mismatches and not missing_mandatory,
        "explanation": [],
    }

def rank_products(products: list[dict], sellers: dict[str, dict], requirement: dict) -> dict:
    eligible, alternatives, rejected = [], [], []
    for product in products:
        if not product.get("active", True):
            continue
        seller = sellers.get(str(product.get("seller_id", "")))
        distance = haversine_km(
            requirement["latitude"], requirement["longitude"],
            product["latitude"], product["longitude"]
        )
        result = score_product(product, requirement, seller, distance)
        reasons = []
        if norm(product["category"]) != norm(requirement["category"]):
            reasons.append("Category does not match exactly")
        if product.get("stock", 0) < requirement["quantity"]:
            reasons.append("Insufficient stock for requested quantity")
        if product.get("minimum_order_quantity", 1) > requirement["quantity"]:
            reasons.append("Requested quantity is below seller's minimum order quantity")
        if requirement.get("max_budget") is not None and result["total_cost"] > requirement["max_budget"]:
            reasons.append("Total product cost exceeds the stated budget")
        if requirement.get("max_distance_km") is not None and distance > requirement["max_distance_km"]:
            reasons.append("Seller is outside the requested distance")
        if requirement.get("max_delivery_days") is not None and product.get("delivery_days", 7) > requirement["max_delivery_days"]:
            reasons.append("Delivery estimate exceeds the requested deadline")
        if result["mandatory_mismatches"]:
            reasons.append("One or more mandatory specifications differ")
        if result["missing_mandatory"]:
            reasons.append("One or more mandatory specifications are not provided")
        result["explanation"] = [
            f"Estimated straight-line distance: {distance:.1f} km",
            f"Estimated product subtotal: ₹{result['total_cost']:.2f} (shipping not included unless supplied)",
            f"Product/specification fit score: {result['score_breakdown']['product_fit']:.0f}/100",
        ]
        result["warnings"] = reasons
        result["product"] = product
        result["seller"] = {
            "id": str(seller.get("_id")) if seller else None,
            "name": seller.get("name", "Seller") if seller else "Seller",
            "reliability_score": seller.get("reliability_score", 65) if seller else 65,
            "verified": bool(seller.get("verified", False)) if seller else False,
        }
        hard_failure = bool(reasons)
        if not hard_failure:
            eligible.append(result)
        elif requirement.get("allow_alternatives", True):
            alternatives.append(result)
        else:
            rejected.append(result)
    eligible.sort(key=lambda x: x["score"], reverse=True)
    alternatives.sort(key=lambda x: x["score"], reverse=True)
    return {
        "weights": WEIGHTS,
        "eligible": eligible,
        "alternatives": alternatives,
        "rejected_count": len(rejected),
        "message": "Scores are heuristic rankings, not probabilities. Distance is straight-line and costs may exclude delivery/taxes unless listed.",
    }
