// ComponenteMappa — componente grafico riutilizzabile (§2.3.6.1).
// Mostra mezzi e aree (vietate/sosta) su tile OpenStreetMap via Leaflet.
// I tile sono richiesti direttamente da Maps API (dipendenza di presentazione, §2.3.3.4).
import { MapContainer, TileLayer, Marker, Circle, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';

// Icona di default Leaflet (fix path bundler).
const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

export interface MapMarker { id: string | number; lat: number; lng: number; label?: string; color?: string; }
export interface MapZone { id: string | number; lat: number; lng: number; radius: number; color: string; label?: string; }

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(center); }, [center[0], center[1]]);
  return null;
}

export default function ComponenteMappa({
  center = [41.1177, 16.8718],
  markers = [],
  zones = [],
  onMapClick,
  height = 420,
}: {
  center?: [number, number];
  markers?: MapMarker[];
  zones?: MapZone[];
  onMapClick?: (lat: number, lng: number) => void;
  height?: number;
}) {
  function ClickCatcher() {
    const map = useMap();
    useEffect(() => {
      if (!onMapClick) return;
      const h = (e: L.LeafletMouseEvent) => onMapClick(e.latlng.lat, e.latlng.lng);
      map.on('click', h);
      return () => { map.off('click', h); };
    }, [map]);
    return null;
  }

  return (
    <div className="map-box" style={{ height }}>
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter center={center} />
        {onMapClick && <ClickCatcher />}
        {zones.map((z) => (
          <Circle key={`z-${z.id}`} center={[z.lat, z.lng]} radius={z.radius}
            pathOptions={{ color: z.color, fillColor: z.color, fillOpacity: 0.18 }}>
            {z.label && <Popup>{z.label}</Popup>}
          </Circle>
        ))}
        {markers.map((m) => (
          <Marker key={`m-${m.id}`} position={[m.lat, m.lng]} icon={icon}>
            {m.label && <Popup>{m.label}</Popup>}
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
