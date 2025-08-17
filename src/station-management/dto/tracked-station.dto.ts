// DTOs for Tracked Station management

export interface TrackedStationDto {
  id: number;
  stationId: string; // BigInt as string for JSON serialization
  name: string;
  isActive: boolean;
  addedDate: string; // ISO date string
  notes?: string;
}

export interface CreateTrackedStationDto {
  stationId: string; // BigInt as string
  notes?: string;
}

export interface UpdateTrackedStationDto {
  isActive?: boolean;
  notes?: string;
}

export interface TrackedStationListDto {
  success: boolean;
  data: TrackedStationDto[];
}

export interface TrackedStationResponseDto {
  success: boolean;
  data: TrackedStationDto;
}

export interface TrackedStationStatsDto {
  success: boolean;
  data: {
    totalTracked: number;
    activeStations: number;
    inactiveStations: number;
    oldestAdded: string; // ISO date string
    newestAdded: string; // ISO date string
  };
}
