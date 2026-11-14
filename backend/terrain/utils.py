BOUNDING_BOX_OFFSET_DEG = 0.005  # Matches Module 2 ~500m half-width bounding box


def build_bounding_box_polygon(
    lat: float,
    lon: float,
    offset_deg: float = BOUNDING_BOX_OFFSET_DEG,
) -> dict:
    """Build a closed GeoJSON Polygon bounding box around (lat, lon)."""
    min_lon = float(lon) - offset_deg
    max_lon = float(lon) + offset_deg
    min_lat = float(lat) - offset_deg
    max_lat = float(lat) + offset_deg

    return {
        'type': 'Polygon',
        'coordinates': [[
            [min_lon, min_lat],
            [max_lon, min_lat],
            [max_lon, max_lat],
            [min_lon, max_lat],
            [min_lon, min_lat],
        ]],
    }
