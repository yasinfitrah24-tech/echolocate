"use client";

// Leaflet + OpenStreetMap map of local sponsors. Leaflet touches `window` when
// it loads, so this file must only be loaded with next/dynamic and ssr: false
// (see local-sponsors.tsx). Circle markers are used so no marker image files
// are needed.

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { LocalPlace } from "@/lib/qloo";

export const CATEGORY_COLORS: Record<string, string> = {
  cafes: "#b45309",
  clothing: "#4f46e5",
  bars: "#be123c",
};

const FALLBACK_COLOR = "#3f3f46";

interface PlacesMapProps {
  places: LocalPlace[];
  center: { lat: number; lon: number };
  selectedId: string | null;
  onSelect: (entityId: string) => void;
}

/** Fits the map to all places once, then flies to the selected one. */
function Viewport({ places, selectedId }: { places: LocalPlace[]; selectedId: string | null }) {
  const map = useMap();

  useEffect(() => {
    if (places.length < 2) return;
    map.fitBounds(
      places.map((place) => [place.lat, place.lon] as [number, number]),
      { padding: [30, 30], maxZoom: 14 },
    );
  }, [map, places]);

  useEffect(() => {
    const place = places.find((item) => item.entityId === selectedId);
    if (place) map.flyTo([place.lat, place.lon], Math.max(map.getZoom(), 14), { duration: 0.6 });
  }, [map, places, selectedId]);

  return null;
}

function price(level: number | null): string | null {
  return level && level > 0 ? "$".repeat(Math.min(level, 4)) : null;
}

export default function PlacesMap({ places, center, selectedId, onSelect }: PlacesMapProps) {
  return (
    <MapContainer
      center={[center.lat, center.lon]}
      zoom={12}
      scrollWheelZoom={false}
      className="h-80 w-full sm:h-96"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Viewport places={places} selectedId={selectedId} />
      {places.map((place) => {
        const color = CATEGORY_COLORS[place.categoryId] ?? FALLBACK_COLOR;
        const selected = place.entityId === selectedId;
        const details = [place.categoryLabel, place.rating ? `${place.rating}★` : null, price(place.priceLevel)]
          .filter(Boolean)
          .join(" · ");
        return (
          <CircleMarker
            key={place.entityId}
            center={[place.lat, place.lon]}
            radius={selected ? 11 : 7}
            pathOptions={{
              color: "#ffffff",
              weight: 2,
              fillColor: color,
              fillOpacity: selected ? 1 : 0.85,
            }}
            eventHandlers={{ click: () => onSelect(place.entityId) }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              {place.name} · {place.fitScore}
            </Tooltip>
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">{place.name}</p>
                <p className="text-zinc-600">{details}</p>
                {place.address && <p className="mt-1">{place.address}</p>}
                <p className="mt-1">Fit score {place.fitScore}</p>
                {place.website && (
                  <a href={place.website} target="_blank" rel="noopener noreferrer">
                    Website
                  </a>
                )}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
