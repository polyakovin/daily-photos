import { NativeModule, requireNativeModule } from 'expo';
import type {
  ArchiveDirectory,
  ArchiveLocation,
  ArchivePhoto,
  ArchiveScanProgress,
  ArchiveViewerMetadata
} from './PhotoArchive.types';

type PhotoArchiveEvents = {
  onScanProgress: (progress: ArchiveScanProgress) => void;
};

declare class PhotoArchiveModule extends NativeModule<PhotoArchiveEvents> {
  clearDirectory(): Promise<void>;
  getCachedPhotos(): Promise<ArchivePhoto[] | null>;
  getDirectory(): Promise<ArchiveDirectory | null>;
  getDisplayUri(uri: string, cacheKey: string): Promise<string>;
  getPhotoExifLocation(uri: string): Promise<ArchiveLocation | null>;
  getPreview(uri: string, cacheKey: string): Promise<string>;
  getViewerMetadata(): Promise<ArchiveViewerMetadata>;
  listPhotos(): Promise<ArchivePhoto[]>;
  movePhoto(uri: string, relativePath: string, targetRelativePath: string): Promise<ArchivePhoto>;
  deletePhoto(uri: string, relativePath: string): Promise<void>;
  saveDiary(date: string, content: string | null): Promise<void>;
  selectDirectory(): Promise<ArchiveDirectory | null>;
  setBlurred(date: string, blurred: boolean): Promise<void>;
  setHighlight(scope: 'month' | 'year', period: string, date: string | null): Promise<void>;
  setPhotoLocation(
    relativePath: string,
    latitude: number | null,
    longitude: number | null,
    place: string | null,
    country: string | null
  ): Promise<void>;
}

export default requireNativeModule<PhotoArchiveModule>('PhotoArchive');
