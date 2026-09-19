import math
from typing import Dict, List, Optional, Tuple, Any

def calculate_statistics(values: List[float]) -> Dict[str, Any]:
    """Calculate deterministic statistics for a list of numerical values."""
    if not values:
        return {}

    first_val = values[0]
    last_val = values[-1]
    min_val = min(values)
    max_val = max(values)
    mean_val = sum(values) / len(values)
    change = last_val - first_val
    
    change_percent = 0.0
    if abs(first_val) > 1e-9:
        change_percent = (change / abs(first_val)) * 100.0

    trend = "stable"
    n = len(values)
    if n < 3:
        trend = "insufficient_data"
    else:
        if change_percent > 3.0:
            trend = "increasing"
        elif change_percent < -3.0:
            trend = "decreasing"
        elif abs(first_val) <= 1e-9:
            # Fallback for zero-starting values
            if change > 1e-3:
                trend = "increasing"
            elif change < -1e-3:
                trend = "decreasing"

    return {
        "first": round(first_val, 4),
        "last": round(last_val, 4),
        "mean": round(mean_val, 4),
        "min": round(min_val, 4),
        "max": round(max_val, 4),
        "change": round(change, 4),
        "change_percent": round(change_percent, 2),
        "trend": trend,
        "observation_count": n
    }

def pearson_correlation(x: List[float], y: List[float]) -> Optional[float]:
    """Calculate Pearson correlation coefficient between two aligned lists."""
    n = len(x)
    if n != len(y) or n < 3:
        return None
        
    mean_x = sum(x) / n
    mean_y = sum(y) / n
    
    numerator = sum((x[i] - mean_x) * (y[i] - mean_y) for i in range(n))
    var_x = sum((x[i] - mean_x) ** 2 for i in range(n))
    var_y = sum((y[i] - mean_y) ** 2 for i in range(n))
    
    denominator = math.sqrt(var_x * var_y)
    
    if denominator < 1e-9:
        return 0.0
        
    return round(numerator / denominator, 2)
