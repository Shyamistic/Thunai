import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap, CircleMarker } from "react-leaflet";
import L from "leaflet";
import { PRIORITY, type Meta, type Ticket } from "../lib/types.ts";
import { RainCanvas } from "./RainCanvas.tsx";

const CENTER: [number, number] = [13.0, 80.205];
// CARTO Dark Matter when a key is configured; Esri dark gray otherwise (no key needed)
const CARTO_KEY = import.meta.env.VITE_CARTO_KEY as string | undefined;

function pinIcon(t: Ticket, isNew: boolean, selected: boolean) {
  const color = t.status === "resolved" ? "#6b8089" : PRIORITY[t.priority].hex;
  const ring = t.status === "live" || (t.priority === 1 && t.status !== "resolved");
  const size = selected ? 30 : t.priority === 1 ? 24 : 20;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div class="pin ${isNew ? "drop" : ""}" style="color:${color};width:${size}px;height:${size}px">
      ${ring ? '<div class="ring"></div>' : ""}<div class="core"></div>
      ${t.cluster && t.cluster.size > 1 ? `<div class="count">×${t.cluster.size}</div>` : ""}
      ${t.source === "voicenote" ? "" : ""}
    </div>`,
  });
}

function Flyer({ target }: { target: Ticket | null }) {
  const map = useMap();
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (!target?.lat || !target.lng) return;
    const key = `${target.id}:${target.locality?.id}`;
    if (last.current === key) return;
    last.current = key;
    map.flyTo([target.lat, target.lng], 13, { duration: 1.6 });
  }, [target, map]);
  return null;
}

export function MapBoard({
  tickets,
  meta,
  fresh,
  focus,
  selected,
  onSelect,
}: {
  tickets: Ticket[];
  meta: Meta | null;
  fresh: string | null;
  focus: Ticket | null;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const placed = useMemo(() => tickets.filter((t) => t.lat && t.lng), [tickets]);
  const counts = useMemo(() => ({ 1: placed.filter((t) => t.priority === 1 && t.status !== "resolved").length, 2: placed.filter((t) => t.priority === 2 && t.status !== "resolved").length, 3: placed.filter((t) => t.priority === 3 && t.status !== "resolved").length }), [placed]);

  return (
    <div className="panel relative h-full min-h-0 overflow-hidden">
      <MapContainer center={CENTER} zoom={11.4} zoomSnap={0.2} zoomControl={false} attributionControl className="h-full w-full">
        {CARTO_KEY ? (
          <TileLayer
            url={`https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            className="tiles-carto"
            maxZoom={19}
          />
        ) : (
          <>
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
              attribution="Tiles &copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors"
              className="tiles-base"
              maxZoom={16}
            />
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}" className="tiles-ref" maxZoom={16} />
          </>
        )}
        {meta?.localities
          .filter((l) => l.floodProne)
          .map((l) => (
            <CircleMarker key={l.id} center={[l.lat, l.lng]} radius={3} pathOptions={{ color: "#2b7a87", weight: 1, opacity: 0.5, fillOpacity: 0.25 }}>
              <Tooltip className="thunai-tip" direction="top" offset={[0, -4]}>
                <div className="text-[11px]">
                  <span className="ta">{l.ta}</span> · {l.en}
                  <div className="text-[10px] text-fog">flood-prone · {l.zone}</div>
                </div>
              </Tooltip>
            </CircleMarker>
          ))}
        {placed.map((t) => (
          <Marker key={t.id} position={[t.lat!, t.lng!]} icon={pinIcon(t, t.id === fresh, t.id === selected)} eventHandlers={{ click: () => onSelect(t.id) }} zIndexOffset={(4 - t.priority) * 100 + (t.status === "live" ? 1000 : 0)}>
            <Tooltip className="thunai-tip" direction="top" offset={[0, -12]}>
              <div className="min-w-[160px] text-[12px]">
                <div className="flex items-center gap-2">
                  <b style={{ color: PRIORITY[t.priority].hex }}>P{t.priority}</b>
                  <span className="ta font-semibold">{t.locality?.ta}</span>
                  <span className="text-mist">{t.locality?.en}</span>
                </div>
                {t.landmark && <div className="text-[11px] text-fog">near {t.landmark}</div>}
                <div className="font-mono text-[10px] text-fog">
                  {t.id} · {t.source === "call" ? "call" : "voice note"}
                </div>
              </div>
            </Tooltip>
          </Marker>
        ))}
        <Flyer target={focus} />
      </MapContainer>

      <RainCanvas intensity={0.9} />

      {/* radar sweep */}
      <div className="pointer-events-none absolute inset-0 z-[401] overflow-hidden">
        <div
          className="absolute left-1/2 top-1/2 h-[160%] w-[160%] -translate-x-1/2 -translate-y-1/2 animate-sweep rounded-full opacity-[0.10]"
          style={{ background: "conic-gradient(from 0deg, transparent 0deg, rgba(244,178,63,0.0) 300deg, rgba(244,178,63,0.9) 360deg)" }}
        />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(4,8,11,0.75) 100%)" }} />
      </div>

      {/* legend */}
      <div className="absolute bottom-3 left-3 z-[500] flex items-center gap-3 rounded-xl border border-line bg-ink-950/80 px-3 py-2 backdrop-blur">
        {([1, 2, 3] as const).map((p) => (
          <div key={p} className="flex items-center gap-1.5 text-[11px]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: PRIORITY[p].hex, boxShadow: `0 0 10px ${PRIORITY[p].hex}` }} />
            <span className="text-mist">P{p} {PRIORITY[p].label}</span>
            <span className="font-mono text-chalk">{counts[p]}</span>
          </div>
        ))}
        <div className="h-4 w-px bg-line" />
        <div className="flex items-center gap-1.5 text-[11px] text-fog">
          <span className="h-2 w-2 rounded-full border border-sea bg-sea/40" /> flood-prone locality
        </div>
      </div>
      <div className="pointer-events-none absolute right-3 top-3 z-[500] rounded-lg border border-p1/40 bg-p1/10 px-2 py-1 font-mono text-[10px] tracking-[0.18em] text-p1">SYNTHETIC DEMO DATA</div>
    </div>
  );
}
