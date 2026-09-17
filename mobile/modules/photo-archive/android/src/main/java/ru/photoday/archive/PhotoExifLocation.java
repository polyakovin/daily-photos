package ru.photoday.archive;

import android.content.Context;
import android.media.ExifInterface;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import java.util.HashMap;
import java.util.Map;

final class PhotoExifLocation {
  private PhotoExifLocation() {}

  static Map<String, Double> read(Context context, Uri source) {
    try (ParcelFileDescriptor descriptor =
        context.getContentResolver().openFileDescriptor(source, "r")) {
      if (descriptor == null) return null;
      float[] coordinates = new float[2];
      if (!new ExifInterface(descriptor.getFileDescriptor()).getLatLong(coordinates)) {
        return null;
      }
      double latitude = coordinates[0];
      double longitude = coordinates[1];
      if (!Double.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
      if (!Double.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
      Map<String, Double> location = new HashMap<>();
      location.put("latitude", latitude);
      location.put("longitude", longitude);
      return location;
    } catch (Exception ignored) {
      return null;
    }
  }
}
