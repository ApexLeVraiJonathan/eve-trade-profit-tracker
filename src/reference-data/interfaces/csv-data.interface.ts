// Interfaces for CSV data structures from Adam4EVE

export interface RegionCsvRow {
  regionID: string;
  regionName: string;
}

export interface SolarSystemCsvRow {
  solarSystemID: string;
  solarSystemName: string;
  regionID: string;
}

export interface StationCsvRow {
  stationID: string;
  solarSystemID: string;
  stationName: string;
}

export interface ItemTypeCsvRow {
  typeID: string;
  typeName: string;
  published: string;
}

// Import statistics interface
export interface ImportStats {
  regions: number;
  solarSystems: number;
  stations: number;
  itemTypes: number;
}

// Fetch result interface
export interface FetchResult {
  downloadedFiles: string[];
  importStats: ImportStats;
}

// Bootstrap result interface
export interface BootstrapResult {
  method: 'fresh' | 'local' | 'skipped';
  message: string;
  stats?: ImportStats;
}

// File availability interface
export interface FileAvailability {
  available: boolean;
  files: { name: string; available: boolean; lastModified?: string }[];
}
