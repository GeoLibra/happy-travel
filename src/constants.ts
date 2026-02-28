import itineraryData from './data/itinerary.json';

export interface Location {
  id: string;
  name: string;
  address: string;
  type: 'sports' | 'hotel' | 'museum' | 'theatre' | 'cafe';
  time?: string;
  description?: string;
  coordinates: [number, number]; // [lng, lat]
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
  cafe: '#10b981'    // green
};
