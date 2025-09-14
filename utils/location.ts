import { calculateDistance } from './geolocation';

// --- Helper Functions ---
export const getGeoLocation = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser.'));
      } else {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 10000, maximumAge: 0
        });
      }
    });
  };


export interface NominatimResult {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  boundingbox: [string, string, string, string];
  lat: string;
  lon: string;
  display_name: string;
  class: string;
  type: string;
  importance: number;
  icon?: string;
}

export const searchLocation = async (query: string): Promise<NominatimResult[]> => {
  if (!query.trim()) {
    return [];
  }
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
    if (!response.ok) {
      throw new Error('Failed to fetch location data.');
    }
    const data: NominatimResult[] = await response.json();
    return data;
  } catch (error) {
    console.error('Error searching location:', error);
    throw error;
  }
};
