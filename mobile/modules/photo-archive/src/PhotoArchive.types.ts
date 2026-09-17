export type ArchiveDirectory = {
  name: string;
  persistent: boolean;
  platform: 'android' | 'ios';
  uri: string;
};

export type ArchivePhoto = {
  modifiedAt?: number;
  name: string;
  relativePath: string;
  uri: string;
};

export type ArchiveLocation = {
  country?: string;
  latitude: number;
  longitude: number;
  place?: string;
};

export type ArchiveViewerMetadata = {
  blurDates: string[];
  diaries: Record<string, string>;
  highlights: {
    months: Record<string, string>;
    years: Record<string, string>;
  };
  locations: Record<string, ArchiveLocation>;
};

export type ArchiveScanProgress = {
  foundPhotos: number;
  phase: 'complete' | 'counting' | 'scanning' | 'starting';
  photos: ArchivePhoto[];
  scannedItems: number;
  totalItems?: number;
};
