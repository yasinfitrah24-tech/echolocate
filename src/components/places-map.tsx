"use client";

// Leaflet + OpenStreetMap map of local sponsors. Leaflet touches `window` when
// it loads, so this file must only be loaded with next/dynamic and ssr: false
// (see local-sponsors.tsx). Circle markers are used so no marker image files
// are needed.
//
// Places with taste data are filled with their category colour; places Qloo
// has little taste data for are hollow grey rings. For a city from the US list,
// a dashed ring shows the area that was really searched, around the point the
// distances are measured from.

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { LocalPlace } from "@/lib/qloo";
import { placeColor } from "./badges";

const INK = "#1c1915";
const LITTLE_DATA_RING = "#7a7268";

export interface SearchArea {
  lat: number;
  lon: number;
  radiusKm: number;
}

interface PlacesMapProps {
  places: LocalPlace[];
  center: { lat: number; lon: number };
  /** The searched circle; null for a city searched by name. */
  searchArea: SearchArea | null;
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

export default function PlacesMap({ places, center, searchArea, selectedId, onSelect }: PlacesMapProps) {
  return (
    <MapContainer
      center={[center.lat, center.lon]}
      zoom={12}
      scrollWheelZoom={false}
      className="places-map h-80 w-full sm:h-96 lg:h-[460px]"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Viewport places={places} selectedId={selectedId} />
      {searchArea && (
        <>
          <Circle
            center={[searchArea.lat, searchArea.lon]}
            radius={searchArea.radiusKm * 1000}
            interactive={false}
            pathOptions={{ color: INK, opacity: 0.6, weight: 1.5, dashArray: "6 6", fill: false }}
          />
          <CircleMarker
            center={[searchArea.lat, searchArea.lon]}
            radius={4}
            interactive={false}
            pathOptions={{ color: INK, weight: 0, fillColor: INK, fillOpacity: 1 }}
          />
        </>
      )}
      {places.map((place) => {
        const selected = place.entityId === selectedId;
        const details = [place.categoryLabel, place.rating ? `${place.rating}★` : null, price(place.priceLevel)]
          .filter(Boolean)
          .join(" · ");
        return (
          <CircleMarker
            key={place.entityId}
            center={[place.lat, place.lon]}
            radius={place.littleData ? (selected ? 9 : 6) : selected ? 11 : 7}
            pathOptions={
              place.littleData
                ? { color: LITTLE_DATA_RING, weight: selected ? 3 : 2.5, fillColor: "#ffffff", fillOpacity: 1 }
                : { color: "#ffffff", weight: 2, fillColor: placeColor(place.categoryId), fillOpacity: selected ? 1 : 0.9 }
            }
            eventHandlers={{ click: () => onSelect(place.entityId) }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              {place.name} · {place.fitScore === null ? "little taste data" : `score ${place.fitScore}`}
            </Tooltip>
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">{place.name}</p>
                <p className="text-ink-2">{details}</p>
                {place.address && <p className="mt-1">{place.address}</p>}
                <p className="mt-1">
                  {place.fitScore === null
                    ? "Little taste data, no score"
                    : `Sponsor Fit Score ${place.fitScore}`}
                </p>
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
