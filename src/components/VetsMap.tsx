import { useEffect, useState } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from './ui/card';

const API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || (window as any).GOOGLE_MAPS_PLATFORM_KEY || '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

function MapMarkers({ filter, search }: { filter: string, search: string }) {
  const placesLib = useMapsLibrary('places');
  const map = useMap();
  const [places, setPlaces] = useState<google.maps.places.Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!placesLib || !map) return;
    
    setLoading(true);
    let categoryText = "pet services";
    if (filter === 'veterinary') categoryText = "veterinary clinic";
    if (filter === 'grooming') categoryText = "pet grooming";
    if (filter === 'pet_store') categoryText = "pet store";
    if (filter === 'rescue_group') categoryText = "animal rescue group";

    const textQuery = `${search ? search + ' ' : ''}${categoryText} in Laoag City, Ilocos Norte`;

    // Search for clinics
    placesLib.Place.searchByText({
      textQuery,
      fields: ['id', 'displayName', 'location', 'formattedAddress', 'rating'],
      maxResultCount: 15,
    }).then(({ places }) => {
      setPlaces(places);
      setLoading(false);
      
      // Auto fit bounds
      if (places.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        places.forEach(p => p.location && bounds.extend(p.location));
        map.fitBounds(bounds, 40);
      }
    }).catch(err => {
      console.error(err);
      setError(err?.message || 'Failed to search places.');
      setLoading(false);
    });
  }, [placesLib, map]);

  if (loading) return null;

  if (error) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-slate-50/90 p-6 z-10">
        <div className="bg-white p-6 rounded-lg shadow-lg border max-w-lg">
          <h3 className="text-red-600 font-bold mb-2">Google Maps Platform Error</h3>
          <p className="text-slate-700 text-sm mb-4">{error}</p>
          <div className="text-sm text-slate-600 space-y-2">
            <p><strong>To fix this issue:</strong></p>
            <p>1. Go to your <a href="https://console.cloud.google.com/apis/library" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">Google Cloud Console</a>.</p>
            <p>2. Ensure the following APIs are <strong>Enabled</strong> for your project:</p>
            <ul className="list-disc pl-5 mt-1 text-slate-700">
              <li><strong>Maps JavaScript API</strong> (needed to display the map)</li>
              <li><strong>Places API (New)</strong> (needed to search for clinics)</li>
            </ul>
            <p className="pt-2 text-xs text-slate-500">Note: After enabling, it may take 5-10 minutes to take effect. If it's a new billing account, ensure billing is active.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {places.map(p => p.location && (
        <AdvancedMarker key={p.id} position={p.location} title={p.displayName || 'Vet'}>
          <Pin background="#4f46e5" glyphColor="#fff" borderColor="#4338ca" />
        </AdvancedMarker>
      ))}
    </>
  );
}

export function VetsMap({ filter, search }: { filter: string, search: string }) {
  if (!hasValidKey) {
    return (
      <Card className="w-full h-[500px] flex items-center justify-center bg-slate-50 border-dashed">
        <CardContent className="text-center p-6">
          <h2 className="text-xl font-bold mb-4 text-slate-800">Google Maps API Key Required</h2>
          <div className="text-sm text-slate-600 max-w-md text-left space-y-2">
            <p>To view the map of available vets in Laoag City, an API Key is required.</p>
            <p><strong>Step 1:</strong> Get a key from Google Cloud Console.</p>
            <p><strong>Step 2:</strong> In AI Studio, click the ⚙️ <strong>Settings</strong> icon (top-right).</p>
            <p><strong>Step 3:</strong> Select <strong>Secrets</strong>, add <code>GOOGLE_MAPS_PLATFORM_KEY</code>, and paste your key.</p>
            <p className="mt-4 pt-4 border-t text-xs">The app will automatically rebuild and show the map once the key is added.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Center on Laoag City
  const laoagCenter = { lat: 18.196, lng: 120.5947 };

  return (
    <div className="w-full h-[600px] rounded-xl overflow-hidden shadow-sm border border-slate-200 relative">
      <APIProvider apiKey={API_KEY} version="weekly">
        <Map
          defaultCenter={laoagCenter}
          defaultZoom={13}
          mapId="LAOAG_VETS_MAP"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          gestureHandling="greedy"
        >
          <MapMarkers filter={filter} search={search} />
        </Map>
      </APIProvider>
    </div>
  );
}
