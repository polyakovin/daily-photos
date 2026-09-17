import CryptoKit
import Dispatch
import ExpoModulesCore
import Foundation
import ImageIO
import QuickLookThumbnailing
import UIKit
import UniformTypeIdentifiers

private let bookmarkKey = "photoArchiveDirectoryBookmark"
private let indexCacheName = "photo-archive-index.json"
private let displayCacheName = "photo-archive-display"
private let previewCacheName = "photo-archive-previews"
private let progressEventName = "onScanProgress"
private let progressPhotoBatchSize = 25
private let progressUpdateCount = 200
private let archiveCoordinatorTimeout: TimeInterval = 12
private let imageExtensions: Set<String> = [
  "avif", "bmp", "gif", "heic", "heif", "jpeg", "jpg", "png", "tif", "tiff", "webp"
]
private let ignoredDirectoryNames: Set<String> = [
  "$recycle.bin", "applications", "library", "lost+found", "music", "node_modules",
  "program files", "program files (x86)", "system", "system volume information", "windows"
]

private struct ScannableItem {
  let isDirectory: Bool
  let modifiedAt: Date?
  let name: String
  let url: URL
}

private final class CoordinatedReadState<Value>: @unchecked Sendable {
  let semaphore = DispatchSemaphore(value: 0)
  private let lock = NSLock()
  private var operationStarted = false
  private var operationResult: Result<Value, Error>?

  var hasStarted: Bool {
    lock.lock()
    defer { lock.unlock() }
    return operationStarted
  }

  var result: Result<Value, Error>? {
    lock.lock()
    defer { lock.unlock() }
    return operationResult
  }

  func markStarted() {
    lock.lock()
    operationStarted = true
    lock.unlock()
  }

  func finish(_ result: Result<Value, Error>) {
    lock.lock()
    operationResult = result
    lock.unlock()
    semaphore.signal()
  }
}

private final class DirectoryPickerDelegate: NSObject, UIDocumentPickerDelegate {
  private let completion: (Result<URL?, Error>) -> Void

  init(completion: @escaping (Result<URL?, Error>) -> Void) {
    self.completion = completion
  }

  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    completion(.success(urls.first))
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    completion(.success(nil))
  }
}

public class PhotoArchiveModule: Module {
  private var activeRoot: URL?
  private var lastScannedItemCount = 0
  private var pickerDelegate: DirectoryPickerDelegate?

  public func definition() -> ModuleDefinition {
    Name("PhotoArchive")
    Events("onScanProgress")

    AsyncFunction("selectDirectory") { (promise: Promise) in
      guard self.pickerDelegate == nil else {
        promise.reject("ERR_PICKER_BUSY", "Выбор папки уже открыт")
        return
      }
      guard let controller = self.appContext?.utilities?.currentViewController() else {
        promise.reject("ERR_NO_CONTROLLER", "Не удалось открыть системный выбор папки")
        return
      }

      let delegate = DirectoryPickerDelegate { result in
        defer { self.pickerDelegate = nil }
        switch result {
        case .success(nil):
          promise.resolve(nil)
        case .success(let selectedURL?):
          do {
            try self.storeAndActivate(selectedURL)
            promise.resolve(self.directoryInfo(selectedURL))
          } catch {
            promise.reject("ERR_DIRECTORY_ACCESS", error.localizedDescription)
          }
        case .failure(let error):
          promise.reject("ERR_DIRECTORY_PICKER", error.localizedDescription)
        }
      }
      self.pickerDelegate = delegate

      let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder], asCopy: false)
      picker.allowsMultipleSelection = false
      picker.delegate = delegate
      controller.present(picker, animated: true)
    }.runOnQueue(.main)

    AsyncFunction("getDirectory") { () -> [String: Any]? in
      guard let root = try self.restoreActiveRoot() else {
        return nil
      }
      return self.directoryInfo(root)
    }

    AsyncFunction("getCachedPhotos") { () -> [[String: Any]]? in
      guard let root = try self.restoreActiveRoot() else {
        return nil
      }
      return self.readIndexCache(root)
    }

    AsyncFunction("getPreview") { (uri: String, cacheKey: String, promise: Promise) in
      self.generatePreview(uri: uri, cacheKey: cacheKey) { result in
        switch result {
        case .success(let previewURL):
          promise.resolve(previewURL.absoluteString)
        case .failure(let error):
          promise.reject("ERR_PREVIEW", error.localizedDescription)
        }
      }
    }

    AsyncFunction("getDisplayUri") { (uri: String, cacheKey: String) -> String in
      return try self.prepareDisplayPhoto(uri: uri, cacheKey: cacheKey).absoluteString
    }

    AsyncFunction("getPhotoExifLocation") { (uri: String) -> [String: Double]? in
      return try self.readPhotoExifLocation(uri: uri)
    }

    AsyncFunction("getViewerMetadata") { () -> [String: Any] in
      guard let root = try self.restoreActiveRoot() else {
        throw self.noDirectoryError()
      }
      return try self.readViewerMetadata(root)
    }

    AsyncFunction("saveDiary") { (date: String, content: String?) in
      guard let root = try self.restoreActiveRoot() else {
        throw self.noDirectoryError()
      }
      try self.saveDiary(root: root, date: date, content: content)
    }

    AsyncFunction("setBlurred") { (date: String, blurred: Bool) in
      guard let root = try self.restoreActiveRoot() else {
        throw self.noDirectoryError()
      }
      try self.setBlurred(root: root, date: date, blurred: blurred)
    }

    AsyncFunction("setHighlight") { (scope: String, period: String, date: String?) in
      guard let root = try self.restoreActiveRoot() else {
        throw self.noDirectoryError()
      }
      try self.setHighlight(root: root, scope: scope, period: period, date: date)
    }

    AsyncFunction("setPhotoLocation") {
      (
        relativePath: String,
        latitude: Double?,
        longitude: Double?,
        place: String?,
        country: String?
      ) in
      guard let root = try self.restoreActiveRoot() else {
        throw self.noDirectoryError()
      }
      try self.setPhotoLocation(
        root: root,
        relativePath: relativePath,
        latitude: latitude,
        longitude: longitude,
        place: place,
        country: country
      )
    }

    AsyncFunction("movePhoto") {
      (uri: String, relativePath: String, targetRelativePath: String) -> [String: Any] in
      guard let root = try self.restoreActiveRoot() else {
        throw self.noDirectoryError()
      }
      return try self.movePhoto(
        root: root,
        uri: uri,
        relativePath: relativePath,
        targetRelativePath: targetRelativePath
      )
    }

    AsyncFunction("deletePhoto") { (uri: String, relativePath: String) in
      guard let root = try self.restoreActiveRoot() else {
        throw self.noDirectoryError()
      }
      try self.deletePhoto(root: root, uri: uri, relativePath: relativePath)
    }

    AsyncFunction("listPhotos") { () -> [[String: Any]] in
      guard let root = try self.restoreActiveRoot() else {
        throw NSError(
          domain: "PhotoArchive",
          code: 1,
          userInfo: [NSLocalizedDescriptionKey: "Сначала выберите папку фотоархива"]
        )
      }
      let photos = try self.scanPhotos(root)
      try self.writeIndexCache(root, photos: photos)
      return photos
    }

    AsyncFunction("clearDirectory") {
      self.stopAccessingRoot()
      UserDefaults.standard.removeObject(forKey: bookmarkKey)
      try? FileManager.default.removeItem(at: self.indexCacheURL())
      try? FileManager.default.removeItem(at: self.displayCacheRootURL())
      try? FileManager.default.removeItem(at: self.previewCacheRootURL())
    }

    OnDestroy {
      self.stopAccessingRoot()
    }
  }

  private func storeAndActivate(_ url: URL) throws {
    try activate(url)
    do {
      let data = try url.bookmarkData(
        options: .minimalBookmark,
        includingResourceValuesForKeys: nil,
        relativeTo: nil
      )
      UserDefaults.standard.set(data, forKey: bookmarkKey)
    } catch {
      stopAccessingRoot()
      throw error
    }
  }

  private func restoreActiveRoot() throws -> URL? {
    if let activeRoot {
      return activeRoot
    }
    guard let data = UserDefaults.standard.data(forKey: bookmarkKey) else {
      return nil
    }

    var isStale = false
    let url = try URL(
      resolvingBookmarkData: data,
      options: .withoutUI,
      relativeTo: nil,
      bookmarkDataIsStale: &isStale
    )
    try activate(url)
    if isStale {
      try storeAndActivate(url)
    }
    return url
  }

  private func activate(_ url: URL) throws {
    if activeRoot?.standardizedFileURL == url.standardizedFileURL {
      return
    }
    guard url.startAccessingSecurityScopedResource() else {
      throw NSError(
        domain: "PhotoArchive",
        code: 2,
        userInfo: [
          NSLocalizedDescriptionKey:
            "iOS не предоставила доступ к выбранной папке. Выберите папку ещё раз в приложении «Файлы»."
        ]
      )
    }
    let previousRoot = activeRoot
    activeRoot = url
    previousRoot?.stopAccessingSecurityScopedResource()
  }

  private func stopAccessingRoot() {
    activeRoot?.stopAccessingSecurityScopedResource()
    activeRoot = nil
  }

  private func directoryInfo(_ url: URL) -> [String: Any] {
    return [
      "name": url.lastPathComponent.isEmpty ? "Фотоархив" : url.lastPathComponent,
      "persistent": true,
      "platform": "ios",
      "uri": url.absoluteString
    ]
  }

  private func noDirectoryError() -> NSError {
    return NSError(
      domain: "PhotoArchive",
      code: 1,
      userInfo: [NSLocalizedDescriptionKey: "Сначала выберите папку фотоархива"]
    )
  }

  private func archiveCoordinatorTimeoutError() -> NSError {
    return NSError(
      domain: "PhotoArchive",
      code: 4,
      userInfo: [
        NSLocalizedDescriptionKey:
          "iCloud не ответил вовремя. Проверьте сеть, скачайте папку в «Файлах» и повторите."
      ]
    )
  }

  private func coordinatedRead<Value>(
    _ url: URL,
    allowsLongOperation: Bool = false,
    operation: @escaping (URL) throws -> Value
  ) throws -> Value {
    let coordinator = NSFileCoordinator()
    let intent = NSFileAccessIntent.readingIntent(with: url, options: [])
    let queue = OperationQueue()
    queue.maxConcurrentOperationCount = 1
    queue.qualityOfService = .userInitiated
    let state = CoordinatedReadState<Value>()

    coordinator.coordinate(with: [intent], queue: queue) { coordinationError in
      state.markStarted()
      if let coordinationError {
        state.finish(.failure(coordinationError))
        return
      }
      state.finish(Result { try operation(intent.url) })
    }

    if state.semaphore.wait(timeout: .now() + archiveCoordinatorTimeout) == .timedOut {
      if !allowsLongOperation || !state.hasStarted {
        coordinator.cancel()
        throw archiveCoordinatorTimeoutError()
      }
      state.semaphore.wait()
    }

    guard let result = state.result else {
      throw archiveCoordinatorTimeoutError()
    }
    return try result.get()
  }

  private func safeRelativePath(_ value: String) throws -> String {
    let normalized = value.replacingOccurrences(of: "\\", with: "/")
      .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let parts = normalized.split(separator: "/", omittingEmptySubsequences: false)
    guard
      !normalized.isEmpty,
      !value.hasPrefix("/"),
      !parts.contains(where: { $0.isEmpty || $0 == "." || $0 == ".." })
    else {
      throw NSError(
        domain: "PhotoArchive",
        code: 6,
        userInfo: [NSLocalizedDescriptionKey: "Некорректный путь внутри фотоархива"]
      )
    }
    return normalized
  }

  private func archiveURL(_ root: URL, relativePath: String) throws -> URL {
    let safePath = try safeRelativePath(relativePath)
    let url = safePath.split(separator: "/").reduce(root) { value, part in
      value.appendingPathComponent(String(part))
    }.standardizedFileURL
    guard url.path.hasPrefix(root.standardizedFileURL.path + "/") else {
      throw NSError(
        domain: "PhotoArchive",
        code: 7,
        userInfo: [NSLocalizedDescriptionKey: "Файл находится вне выбранного фотоархива"]
      )
    }
    return url
  }

  private func coordinatedWrite<T>(_ root: URL, operation: (URL) throws -> T) throws -> T {
    var coordinationError: NSError?
    var result: Result<T, Error>?
    NSFileCoordinator().coordinate(writingItemAt: root, options: [], error: &coordinationError) {
      coordinatedRoot in
      result = Result { try operation(coordinatedRoot) }
    }
    if let coordinationError { throw coordinationError }
    guard let result else {
      throw NSError(
        domain: "PhotoArchive",
        code: 8,
        userInfo: [NSLocalizedDescriptionKey: "Хранилище не выполнило операцию с файлом"]
      )
    }
    return try result.get()
  }

  private func readJSON(_ url: URL) -> [String: Any] {
    guard
      let data = try? Data(contentsOf: url),
      let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else {
      return [:]
    }
    return value
  }

  private func writeJSON(_ value: Any, to url: URL) throws {
    let data = try JSONSerialization.data(
      withJSONObject: value,
      options: [.prettyPrinted, .sortedKeys]
    )
    try FileManager.default.createDirectory(
      at: url.deletingLastPathComponent(),
      withIntermediateDirectories: true
    )
    var terminated = data
    terminated.append(0x0a)
    try terminated.write(to: url, options: .atomic)
  }

  private func readViewerMetadata(_ root: URL) throws -> [String: Any] {
    return try coordinatedRead(root) { coordinatedRoot in
      var diaries: [String: String] = [:]
      let diaryRoot = coordinatedRoot.appendingPathComponent("_diary", isDirectory: true)
      if let entries = try? FileManager.default.contentsOfDirectory(
        at: diaryRoot,
        includingPropertiesForKeys: nil,
        options: [.skipsHiddenFiles]
      ) {
        for entry in entries where entry.pathExtension.lowercased() == "md" {
          let stem = entry.deletingPathExtension().lastPathComponent
          let date = stem.replacingOccurrences(of: ".", with: "-")
          if self.validDate(date), let content = try? String(contentsOf: entry, encoding: .utf8) {
            diaries[date] = content
          }
        }
      }

      let blurURL = coordinatedRoot.appendingPathComponent("presentation_blur_dates.json")
      let blurDates = ((try? Data(contentsOf: blurURL))
        .flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String] } ?? [])
        .filter(self.validDate)

      let highlightURL = coordinatedRoot.appendingPathComponent("period_photo_selections.json")
      let highlightDocument = self.readJSON(highlightURL)
      let highlights: [String: Any] = [
        "months": highlightDocument["months"] as? [String: Any] ?? [:],
        "years": highlightDocument["years"] as? [String: Any] ?? [:]
      ]

      let locationURL = coordinatedRoot.appendingPathComponent("photo_locations.json")
      let locationDocument = self.readJSON(locationURL)
      let locations = locationDocument["photos"] as? [String: Any]
        ?? (locationDocument["version"] == nil ? locationDocument : [:])
      return [
        "blurDates": blurDates,
        "diaries": diaries,
        "highlights": highlights,
        "locations": locations
      ]
    }
  }

  private func validDate(_ value: String) -> Bool {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.dateFormat = "yyyy-MM-dd"
    formatter.isLenient = false
    return value.range(of: #"^(?:19|20)\d{2}-\d{2}-\d{2}$"#, options: .regularExpression) != nil
      && formatter.date(from: value) != nil
  }

  private func saveDiary(root: URL, date: String, content: String?) throws {
    guard validDate(date) else {
      throw NSError(
        domain: "PhotoArchive",
        code: 9,
        userInfo: [NSLocalizedDescriptionKey: "Дата заметки должна быть в формате ГГГГ-ММ-ДД"]
      )
    }
    if let content, content.count > 500_000 {
      throw NSError(
        domain: "PhotoArchive",
        code: 10,
        userInfo: [NSLocalizedDescriptionKey: "Заметка слишком большая"]
      )
    }
    try coordinatedWrite(root) { coordinatedRoot in
      let diaryRoot = coordinatedRoot.appendingPathComponent("_diary", isDirectory: true)
      let target = diaryRoot.appendingPathComponent(date.replacingOccurrences(of: "-", with: ".") + ".md")
      if let content, !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
        try FileManager.default.createDirectory(at: diaryRoot, withIntermediateDirectories: true)
        try Data(content.utf8).write(to: target, options: .atomic)
      } else if FileManager.default.fileExists(atPath: target.path) {
        try FileManager.default.removeItem(at: target)
      }
    }
  }

  private func setBlurred(root: URL, date: String, blurred: Bool) throws {
    guard validDate(date) else { throw noDirectoryError() }
    try coordinatedWrite(root) { coordinatedRoot in
      let target = coordinatedRoot.appendingPathComponent("presentation_blur_dates.json")
      let stored = ((try? Data(contentsOf: target))
        .flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String] } ?? [])
      var values = Set(stored.filter(self.validDate))
      if blurred { values.insert(date) } else { values.remove(date) }
      try self.writeJSON(values.sorted(), to: target)
    }
  }

  private func setHighlight(
    root: URL,
    scope: String,
    period: String,
    date: String?
  ) throws {
    guard ["month", "year"].contains(scope) else {
      throw NSError(
        domain: "PhotoArchive",
        code: 11,
        userInfo: [NSLocalizedDescriptionKey: "Неизвестный тип отметки периода"]
      )
    }
    if let date, !validDate(date) || !date.hasPrefix(period + (scope == "month" ? "-" : "-")) {
      throw NSError(
        domain: "PhotoArchive",
        code: 12,
        userInfo: [NSLocalizedDescriptionKey: "Фотография не относится к выбранному периоду"]
      )
    }
    try coordinatedWrite(root) { coordinatedRoot in
      let target = coordinatedRoot.appendingPathComponent("period_photo_selections.json")
      let document = self.readJSON(target)
      var years = document["years"] as? [String: Any] ?? [:]
      var months = document["months"] as? [String: Any] ?? [:]
      if scope == "month" {
        if let date { months[period] = date } else { months.removeValue(forKey: period) }
      } else {
        if let date { years[period] = date } else { years.removeValue(forKey: period) }
      }
      try self.writeJSON(["years": years, "months": months], to: target)
    }
  }

  private func setPhotoLocation(
    root: URL,
    relativePath: String,
    latitude: Double?,
    longitude: Double?,
    place: String?,
    country: String?
  ) throws {
    let path = try safeRelativePath(relativePath)
    let hasCoordinates = latitude != nil || longitude != nil
    if hasCoordinates && (
      latitude == nil || longitude == nil
      || latitude! < -90 || latitude! > 90
      || longitude! < -180 || longitude! > 180
    ) {
      throw NSError(
        domain: "PhotoArchive",
        code: 13,
        userInfo: [NSLocalizedDescriptionKey: "Укажите корректные широту и долготу"]
      )
    }
    try coordinatedWrite(root) { coordinatedRoot in
      let target = coordinatedRoot.appendingPathComponent("photo_locations.json")
      var document = self.readJSON(target)
      var photos = document["photos"] as? [String: Any]
        ?? (document["version"] == nil ? document : [:])
      if let latitude, let longitude {
        var location: [String: Any] = [
          "latitude": latitude,
          "longitude": longitude,
          "source": "manual"
        ]
        if let place, !place.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
          location["place"] = String(place.trimmingCharacters(in: .whitespacesAndNewlines).prefix(240))
        }
        if let country, !country.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
          location["country"] = String(country.trimmingCharacters(in: .whitespacesAndNewlines).prefix(120))
        }
        photos[path] = location
      } else {
        photos.removeValue(forKey: path)
      }
      document["version"] = 2
      document["photos"] = photos
      try self.writeJSON(document, to: target)
    }
  }

  private func uniqueDestination(_ proposed: URL, excluding source: URL) -> URL {
    if proposed.standardizedFileURL == source.standardizedFileURL
      || !FileManager.default.fileExists(atPath: proposed.path) {
      return proposed
    }
    let directory = proposed.deletingLastPathComponent()
    let stem = proposed.deletingPathExtension().lastPathComponent
    let pathExtension = proposed.pathExtension
    for sequence in 2...9_999 {
      let name = "\(stem) (\(sequence))" + (pathExtension.isEmpty ? "" : ".\(pathExtension)")
      let candidate = directory.appendingPathComponent(name)
      if !FileManager.default.fileExists(atPath: candidate.path) { return candidate }
    }
    return proposed
  }

  private func movePhoto(
    root: URL,
    uri: String,
    relativePath: String,
    targetRelativePath: String
  ) throws -> [String: Any] {
    let sourcePath = try safeRelativePath(relativePath)
    _ = try safeRelativePath(targetRelativePath)
    return try coordinatedWrite(root) { coordinatedRoot in
      let source = try self.archiveURL(coordinatedRoot, relativePath: sourcePath)
      if let supplied = URL(string: uri), supplied.isFileURL,
        supplied.standardizedFileURL != source.standardizedFileURL {
        throw NSError(
          domain: "PhotoArchive",
          code: 14,
          userInfo: [NSLocalizedDescriptionKey: "Фотография изменилась после индексирования"]
        )
      }
      guard FileManager.default.fileExists(atPath: source.path) else {
        throw NSError(
          domain: "PhotoArchive",
          code: 15,
          userInfo: [NSLocalizedDescriptionKey: "Оригинал фотографии больше не существует"]
        )
      }
      let proposed = try self.archiveURL(coordinatedRoot, relativePath: targetRelativePath)
      try FileManager.default.createDirectory(
        at: proposed.deletingLastPathComponent(),
        withIntermediateDirectories: true
      )
      let destination = self.uniqueDestination(proposed, excluding: source)
      if destination.standardizedFileURL != source.standardizedFileURL {
        try FileManager.default.moveItem(at: source, to: destination)
      }
      try? FileManager.default.removeItem(at: self.indexCacheURL())
      let rootPath = coordinatedRoot.standardizedFileURL.path
      let nextRelativePath = String(destination.standardizedFileURL.path.dropFirst(rootPath.count + 1))
      let values = try? destination.resourceValues(forKeys: [.contentModificationDateKey, .nameKey])
      var photo: [String: Any] = [
        "name": values?.name ?? destination.lastPathComponent,
        "relativePath": nextRelativePath,
        "uri": destination.absoluteString
      ]
      if let modifiedAt = values?.contentModificationDate {
        photo["modifiedAt"] = modifiedAt.timeIntervalSince1970 * 1000
      }
      return photo
    }
  }

  private func deletePhoto(root: URL, uri: String, relativePath: String) throws {
    try coordinatedWrite(root) { coordinatedRoot in
      let source = try self.archiveURL(coordinatedRoot, relativePath: relativePath)
      if let supplied = URL(string: uri), supplied.isFileURL,
        supplied.standardizedFileURL != source.standardizedFileURL {
        throw NSError(
          domain: "PhotoArchive",
          code: 16,
          userInfo: [NSLocalizedDescriptionKey: "Фотография изменилась после индексирования"]
        )
      }
      try FileManager.default.removeItem(at: source)
      try? FileManager.default.removeItem(at: self.indexCacheURL())
    }
  }

  private func scanPhotos(_ root: URL) throws -> [[String: Any]] {
    lastScannedItemCount = 0
    sendScanProgress(
      phase: "starting",
      scannedItems: 0,
      totalItems: nil,
      foundPhotos: 0,
      photos: []
    )
    let photos = try coordinatedRead(root, allowsLongOperation: true) { coordinatedRoot in
      self.sendScanProgress(
        phase: "counting",
        scannedItems: 0,
        totalItems: nil,
        foundPhotos: 0,
        photos: []
      )
      let items = self.collectScannableItems(coordinatedRoot)
      return self.enumeratePhotos(coordinatedRoot, items: items)
    }
    sendScanProgress(
      phase: "complete",
      scannedItems: lastScannedItemCount,
      totalItems: lastScannedItemCount,
      foundPhotos: photos.count,
      photos: []
    )
    return photos
  }

  private func collectScannableItems(_ root: URL) -> [ScannableItem] {
    let keys: Set<URLResourceKey> = [
      .contentModificationDateKey,
      .isDirectoryKey,
      .nameKey
    ]
    guard let enumerator = FileManager.default.enumerator(
      at: root,
      includingPropertiesForKeys: Array(keys),
      options: [.skipsHiddenFiles, .skipsPackageDescendants],
      errorHandler: { _, _ in true }
    ) else {
      return []
    }
    var items: [ScannableItem] = []
    for case let url as URL in enumerator {
      let values = try? url.resourceValues(forKeys: keys)
      let name = values?.name ?? url.lastPathComponent
      let isDirectory = values?.isDirectory == true
      items.append(ScannableItem(
        isDirectory: isDirectory,
        modifiedAt: values?.contentModificationDate,
        name: name,
        url: url
      ))
      if isDirectory {
        let name = name.lowercased()
        if ignoredDirectoryNames.contains(name) {
          enumerator.skipDescendants()
        }
      }
    }
    return items
  }

  private func enumeratePhotos(_ root: URL, items: [ScannableItem]) -> [[String: Any]] {
    let totalItems = items.count
    let progressItemInterval = max(1, (totalItems + progressUpdateCount - 1) / progressUpdateCount)
    let rootPath = root.standardizedFileURL.path
    var photos: [[String: Any]] = []
    var pendingPhotos: [[String: Any]] = []
    var scannedItems = 0
    sendScanProgress(
      phase: "scanning",
      scannedItems: 0,
      totalItems: totalItems,
      foundPhotos: 0,
      photos: []
    )
    for item in items {
      scannedItems += 1
      if !item.isDirectory {
        let url = item.url
        if imageExtensions.contains(url.pathExtension.lowercased()) {
          let path = url.standardizedFileURL.path
          let relativePath = path.hasPrefix(rootPath + "/")
            ? String(path.dropFirst(rootPath.count + 1))
            : url.lastPathComponent
          var photo: [String: Any] = [
            "name": item.name,
            "relativePath": relativePath,
            "uri": url.absoluteString
          ]
          if let modifiedAt = item.modifiedAt {
            photo["modifiedAt"] = modifiedAt.timeIntervalSince1970 * 1000
          }
          photos.append(photo)
          pendingPhotos.append(photo)
        }
      }
      if pendingPhotos.count >= progressPhotoBatchSize
        || scannedItems % progressItemInterval == 0 {
        sendScanProgress(
          phase: "scanning",
          scannedItems: scannedItems,
          totalItems: totalItems,
          foundPhotos: photos.count,
          photos: pendingPhotos
        )
        pendingPhotos.removeAll(keepingCapacity: true)
      }
    }
    if !pendingPhotos.isEmpty || scannedItems > 0 {
      sendScanProgress(
        phase: "scanning",
        scannedItems: scannedItems,
        totalItems: totalItems,
        foundPhotos: photos.count,
        photos: pendingPhotos
      )
    }
    lastScannedItemCount = scannedItems
    return photos
  }

  private func sendScanProgress(
    phase: String,
    scannedItems: Int,
    totalItems: Int?,
    foundPhotos: Int,
    photos: [[String: Any]]
  ) {
    var payload: [String: Any] = [
      "phase": phase,
      "scannedItems": scannedItems,
      "foundPhotos": foundPhotos,
      "photos": photos
    ]
    if let totalItems { payload["totalItems"] = totalItems }
    sendEvent(progressEventName, payload)
  }

  private func indexCacheURL() -> URL {
    let applicationSupport = FileManager.default.urls(
      for: .applicationSupportDirectory,
      in: .userDomainMask
    )[0]
    return applicationSupport.appendingPathComponent(indexCacheName, isDirectory: false)
  }

  private func readIndexCache(_ root: URL) -> [[String: Any]]? {
    do {
      let data = try Data(contentsOf: indexCacheURL())
      guard
        let payload = try JSONSerialization.jsonObject(with: data) as? [String: Any],
        payload["rootURI"] as? String == root.absoluteString,
        let photos = payload["photos"] as? [[String: Any]]
      else {
        return nil
      }
      return photos
    } catch {
      return nil
    }
  }

  private func writeIndexCache(_ root: URL, photos: [[String: Any]]) throws {
    let cacheURL = indexCacheURL()
    try FileManager.default.createDirectory(
      at: cacheURL.deletingLastPathComponent(),
      withIntermediateDirectories: true
    )
    let data = try JSONSerialization.data(withJSONObject: [
      "rootURI": root.absoluteString,
      "photos": photos
    ])
    try data.write(to: cacheURL, options: .atomic)
  }

  private func previewCacheURL(cacheKey: String) throws -> URL {
    let digest = SHA256.hash(data: Data(cacheKey.utf8))
      .map { String(format: "%02x", $0) }
      .joined()
    let cacheRoot = previewCacheRootURL()
    try FileManager.default.createDirectory(at: cacheRoot, withIntermediateDirectories: true)
    return cacheRoot.appendingPathComponent("\(digest).jpg", isDirectory: false)
  }

  private func cacheDigest(_ cacheKey: String) -> String {
    return SHA256.hash(data: Data(cacheKey.utf8))
      .map { String(format: "%02x", $0) }
      .joined()
  }

  private func displayCacheRootURL() -> URL {
    return FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
      .appendingPathComponent(displayCacheName, isDirectory: true)
  }

  private func prepareDisplayPhoto(uri: String, cacheKey: String) throws -> URL {
    guard let source = URL(string: uri), source.isFileURL else {
      throw NSError(
        domain: "PhotoArchive",
        code: 17,
        userInfo: [NSLocalizedDescriptionKey: "Некорректный адрес фотографии"]
      )
    }
    let cacheRoot = displayCacheRootURL()
    try FileManager.default.createDirectory(at: cacheRoot, withIntermediateDirectories: true)
    let fileExtension = source.pathExtension.isEmpty ? "img" : source.pathExtension.lowercased()
    let digest = cacheDigest(cacheKey)
    let destination = cacheRoot.appendingPathComponent(
      "\(digest).\(fileExtension)",
      isDirectory: false
    )
    if
      let values = try? destination.resourceValues(forKeys: [.fileSizeKey]),
      (values.fileSize ?? 0) > 0
    {
      return destination
    }
    let temporary = cacheRoot.appendingPathComponent(".\(digest).tmp", isDirectory: false)
    try? FileManager.default.removeItem(at: temporary)
    defer { try? FileManager.default.removeItem(at: temporary) }
    try? FileManager.default.startDownloadingUbiquitousItem(at: source)
    var coordinationError: NSError?
    var copyResult: Result<Void, Error>?
    NSFileCoordinator().coordinate(
      readingItemAt: source,
      options: [],
      error: &coordinationError
    ) { coordinatedSource in
      copyResult = Result {
        try FileManager.default.copyItem(at: coordinatedSource, to: temporary)
        let values = try temporary.resourceValues(forKeys: [.fileSizeKey])
        guard (values.fileSize ?? 0) > 0 else {
          throw NSError(
            domain: "PhotoArchive",
            code: 18,
            userInfo: [NSLocalizedDescriptionKey: "Фотография пока не загружена из iCloud"]
          )
        }
        try FileManager.default.moveItem(at: temporary, to: destination)
      }
    }
    if let coordinationError { throw coordinationError }
    guard let copyResult else {
      throw NSError(
        domain: "PhotoArchive",
        code: 19,
        userInfo: [NSLocalizedDescriptionKey: "Хранилище не предоставило фотографию"]
      )
    }
    try copyResult.get()
    return destination
  }

  private func readPhotoExifLocation(uri: String) throws -> [String: Double]? {
    guard let source = URL(string: uri), source.isFileURL else { return nil }
    try? FileManager.default.startDownloadingUbiquitousItem(at: source)
    var coordinationError: NSError?
    var location: [String: Double]?
    NSFileCoordinator().coordinate(
      readingItemAt: source,
      options: [],
      error: &coordinationError
    ) { coordinatedSource in
      guard
        let imageSource = CGImageSourceCreateWithURL(coordinatedSource as CFURL, nil),
        let properties = CGImageSourceCopyPropertiesAtIndex(imageSource, 0, nil)
          as? [CFString: Any],
        let gps = properties[kCGImagePropertyGPSDictionary] as? [CFString: Any],
        let latitudeValue = gps[kCGImagePropertyGPSLatitude] as? NSNumber,
        let longitudeValue = gps[kCGImagePropertyGPSLongitude] as? NSNumber
      else { return }
      var latitude = latitudeValue.doubleValue
      var longitude = longitudeValue.doubleValue
      if let reference = gps[kCGImagePropertyGPSLatitudeRef] as? String,
        reference.uppercased() == "S" { latitude *= -1 }
      if let reference = gps[kCGImagePropertyGPSLongitudeRef] as? String,
        reference.uppercased() == "W" { longitude *= -1 }
      if latitude >= -90, latitude <= 90, longitude >= -180, longitude <= 180 {
        location = ["latitude": latitude, "longitude": longitude]
      }
    }
    if let coordinationError { throw coordinationError }
    return location
  }

  private func previewCacheRootURL() -> URL {
    return FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
      .appendingPathComponent(previewCacheName, isDirectory: true)
  }

  private func generatePreview(
    uri: String,
    cacheKey: String,
    completion: @escaping (Result<URL, Error>) -> Void
  ) {
    do {
      let destination = try previewCacheURL(cacheKey: cacheKey)
      if
        let values = try? destination.resourceValues(forKeys: [.fileSizeKey]),
        (values.fileSize ?? 0) > 0
      {
        completion(.success(destination))
        return
      }
      guard let source = URL(string: uri), source.isFileURL else {
        throw NSError(
          domain: "PhotoArchive",
          code: 4,
          userInfo: [NSLocalizedDescriptionKey: "Некорректный адрес фотографии"]
        )
      }
      func requestThumbnail(allowDownloadFallback: Bool) {
        let request = QLThumbnailGenerator.Request(
          fileAt: source,
          size: CGSize(width: 480, height: 480),
          scale: 1,
          representationTypes: .thumbnail
        )
        QLThumbnailGenerator.shared.generateBestRepresentation(for: request) { representation, error in
          do {
            if let error { throw error }
            guard
              let data = representation?.uiImage.jpegData(compressionQuality: 0.72),
              !data.isEmpty
            else {
              throw NSError(
                domain: "PhotoArchive",
                code: 5,
                userInfo: [NSLocalizedDescriptionKey: "Не удалось создать превью фотографии"]
              )
            }
            try data.write(to: destination, options: .atomic)
            completion(.success(destination))
          } catch {
            if allowDownloadFallback {
              try? FileManager.default.startDownloadingUbiquitousItem(at: source)
              requestThumbnail(allowDownloadFallback: false)
            } else {
              completion(.failure(error))
            }
          }
        }
      }
      requestThumbnail(allowDownloadFallback: true)
    } catch {
      completion(.failure(error))
    }
  }
}
