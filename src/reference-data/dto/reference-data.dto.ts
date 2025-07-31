// DTOs for Reference Data API responses and requests

export interface ReferenceDataStatsDto {
  success: boolean;
  data: {
    regions: number;
    solarSystems: number;
    stations: number;
    itemTypes: number;
  };
}

export interface ImportResultDto {
  success: boolean;
  message: string;
}

export interface FreshDataResultDto {
  success: boolean;
  message: string;
  data: {
    downloadedFiles: number;
    newItems: {
      regions: number;
      solarSystems: number;
      stations: number;
      itemTypes: number;
    };
  };
}

export interface BootstrapResultDto {
  success: boolean;
  message: string;
  data: {
    method: 'fresh' | 'local' | 'skipped';
    stats?: {
      regions: number;
      solarSystems: number;
      stations: number;
      itemTypes: number;
    };
  };
}

export interface AvailabilityCheckDto {
  success: boolean;
  data: {
    available: boolean;
    files: FileAvailabilityDto[];
  };
}

export interface FileAvailabilityDto {
  name: string;
  available: boolean;
  lastModified?: string;
}

export interface ErrorResponseDto {
  success: false;
  message: string;
}
