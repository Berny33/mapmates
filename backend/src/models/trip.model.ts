export type TripType = 'solo' | 'collaborative';

export type TripRole = 'organizer' | 'member';

export interface Trip {
  id: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  type: TripType;
  maxMembers: number;
  createdAt: Date;
}

export interface NewTrip {
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  type: TripType;
  maxMembers: number;
}

export interface TripWithRole extends Trip {
  role: TripRole;
}
