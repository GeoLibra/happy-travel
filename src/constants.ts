import itineraryData from './data/itinerary.json';

export interface Location {
  id: string;
  name: string;
  nameEn: string;
  address: string;
  addressEn: string;
  type: 'sports' | 'hotel' | 'museum' | 'theatre' | 'cafe' | 'park' | 'restaurant' | 'citywalk' | 'spa';
  time?: string;
  description?: string;
  descriptionEn?: string;
  coordinates: [number, number]; // [lng, lat]
  url?: string;
}

export interface DayPlan {
  date: string;
  locations: Location[];
}

export const ITINERARY_DATA: DayPlan[] = itineraryData as DayPlan[];

export const TYPE_COLORS = {
  sports: '#3b82f6', // blue
  hotel: '#f59e0b',  // orange
  museum: '#8b5cf6', // purple
  theatre: '#ef4444', // red
  cafe: '#10b981',   // green
  park: '#84cc16',   // lime
  restaurant: '#ec4899', // pink
  citywalk: '#06b6d4', // cyan
  spa: '#6366f1' // indigo
};
