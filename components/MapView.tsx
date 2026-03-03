'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Emergency } from '@/lib/firestore';

interface MapViewProps {
  emergencies: Emergency[];
  highlightedId?: string | null;
  onMarkerClick?: (id: string) => void;
}

const priorityIconColors = {
  HIGH: '#ef4444',
  MEDIUM: '#f97316',
  LOW: '#eab308',
  RESOLVED: '#22c55e',
};

const createCustomIcon = (priority: 'HIGH' | 'MEDIUM' | 'LOW' | 'RESOLVED') => {
  const color = priorityIconColors[priority];
  
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 24px;
        height: 24px;
        background: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      "></div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
};

function MapController({ center }: { center: [number, number] | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.flyTo(center, 14, { duration: 1 });
    }
  }, [center, map]);
  
  return null;
}

export default function MapView({ 
  emergencies, 
  highlightedId,
  onMarkerClick 
}: MapViewProps) {
  const defaultCenter: [number, number] = [40.7128, -74.006];
  const defaultZoom = 12;

  const newestEmergency = emergencies.length > 0 
    ? emergencies.reduce((latest, current) => 
        current.createdAt > latest.createdAt ? current : latest
      )
    : null;

  const center: [number, number] | null = newestEmergency
    ? [newestEmergency.latitude, newestEmergency.longitude]
    : null;

  return (
    <div className="h-full w-full rounded-2xl overflow-hidden shadow-lg">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {center && <MapController center={center} />}
        
        {emergencies.map((emergency) => (
          <Marker
            key={emergency.id}
            position={[emergency.latitude, emergency.longitude]}
            icon={createCustomIcon(
              emergency.status === 'RESOLVED' ? 'RESOLVED' : emergency.aiPriority
            )}
            eventHandlers={{
              click: () => onMarkerClick?.(emergency.id),
            }}
          >
            <Popup>
              <div className="text-center p-2">
                <p className="font-bold">
                  Priority: {emergency.status === 'RESOLVED' ? 'RESOLVED' : emergency.aiPriority}
                </p>
                <p className="text-sm">
                  {new Date(emergency.createdAt).toLocaleTimeString()}
                </p>
                {emergency.audioUrl && (
                  <audio
                    controls
                    src={emergency.audioUrl}
                    className="mt-2 w-full h-8"
                  />
                )}
                {emergency.googleMapsUrl && (
                  <a
                    href={emergency.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block px-3 py-1 bg-blue-500 text-white text-sm rounded-full hover:bg-blue-600 transition-colors"
                  >
                    🗺️ Open in Google Maps
                  </a>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
