"use client";

// Leaflet + OpenStreetMap map of local sponsors. Leaflet touches `window` when
// it loads, so this file must only be loaded with next/dynamic and ssr: false
// (see local-sponsors.tsx). No marker image files are needed.
//
// Places with taste data are round stickers in their category colour with
// their number in the list; places Qloo has little taste data for are small
// hollow rings. For a city from the US list, a dashed ring shows the area
// that was really searched, around the point the distances are measured from.

import "leaflet/dist/leaflet.css";
import { divIcon } from "leaflet";
import { useEffect, useMemo } from "react";
import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { LocalPlace } from "@/lib/qloo";
import { placeColor } from "./badges";

const INK = "#1e1430";
const LITTLE_DATA_RING = "#77726b";

export interface SearchArea {
  lat: number;
  lon: number;
  radiusKm: number;
}

interface PlacesMapProps {
  places: LocalPlace[];
  /** Number in the list for each place with a score, shown on its pin. */
  numbers: Map<string, number>;
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

/** A round sticker: category colour, white rim, white number. */
function pinIcon(color: string, number: number, selected: boolean) {
  const size = selected ? 34 : 28;
  return divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    tooltipAnchor: [0, -size / 2],
    popupAnchor: [0, -size / 2],
    html: `<span style="display:grid;place-items:center;width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(30,20,48,.45);color:#fff;font:700 ${selected ? 15 : 13}px/1 var(--font-atkinson),sans-serif">${number}</span>`,
  });
}

function PlacePopup({ place }: { place: LocalPlace }) {
  const details = [place.categoryLabel, place.rating ? `${place.rating}★` : null, price(place.priceLevel)]
    .filter(Boolean)
    .join(" · ");
  return (
    <Popup>
      <div className="text-sm">
        <p className="font-bold">{place.name}</p>
        <p className="text-ink-2">{details}</p>
        {place.address && <p className="mt-1">{place.address}</p>}
        <p className="mt-1">
          {place.fitScore === null ? "Little taste data, no score" : `Sponsor Fit Score ${place.fitScore}`}
        </p>
        {place.website && (
          <a href={place.website} target="_blank" rel="noopener noreferrer">
            Website
          </a>
        )}
      </div>
    </Popup>
  );
}

export default function PlacesMap({ places, numbers, center, searchArea, selectedId, onSelect }: PlacesMapProps) {
  // One icon per pin and state, so markers are not rebuilt on every render.
  const icons = useMemo(() => {
    const result = new Map<string, ReturnType<typeof divIcon>>();
    for (const place of places) {
      const number = numbers.get(place.entityId);
      if (number === undefined) continue;
      result.set(place.entityId, pinIcon(placeColor(place.categoryId), number, place.entityId === selectedId));
    }
    return result;
  }, [places, numbers, selectedId]);

  return (
    <MapContainer
      center={[center.lat, center.lon]}
      zoom={12}
      scrollWheelZoom={false}
      className="places-map h-[280px] w-full md:h-[440px]"
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
            pathOptions={{ color: INK, opacity: 0.85, weight: 2, dashArray: "7 7", fill: false }}
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
        const icon = icons.get(place.entityId);
        const tooltip = (
          <Tooltip direction="top" offset={[0, -4]}>
            {place.name} · {place.fitScore === null ? "little taste data" : `score ${place.fitScore}`}
          </Tooltip>
        );
        return icon ? (
          <Marker
            key={place.entityId}
            position={[place.lat, place.lon]}
            icon={icon}
            zIndexOffset={selected ? 1000 : 0}
            eventHandlers={{ click: () => onSelect(place.entityId) }}
          >
            {tooltip}
            <PlacePopup place={place} />
          </Marker>
        ) : (
          <CircleMarker
            key={place.entityId}
            center={[place.lat, place.lon]}
            radius={selected ? 9 : 6}
            pathOptions={{ color: LITTLE_DATA_RING, weight: selected ? 3 : 2, fillColor: "#ffffff", fillOpacity: 1 }}
            eventHandlers={{ click: () => onSelect(place.entityId) }}
          >
            {tooltip}
            <PlacePopup place={place} />
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
