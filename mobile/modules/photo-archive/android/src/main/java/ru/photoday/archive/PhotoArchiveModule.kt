package ru.photoday.archive

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import android.util.Size
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import org.json.JSONArray
import org.json.JSONObject

private const val PICK_DIRECTORY_REQUEST = 43017
private const val PREFERENCES_NAME = "photo_archive"
private const val DIRECTORY_URI_KEY = "directory_uri"
private const val INDEX_CACHE_NAME = "photo-archive-index.json"
private const val DISPLAY_CACHE_NAME = "photo-archive-display"
private const val PREVIEW_CACHE_NAME = "photo-archive-previews"
private const val PROGRESS_EVENT_NAME = "onScanProgress"
private const val PROGRESS_PHOTO_BATCH_SIZE = 25
private const val PROGRESS_UPDATE_COUNT = 200

private val imageExtensions = setOf(
  "avif", "bmp", "gif", "heic", "heif", "jpeg", "jpg", "png", "tif", "tiff", "webp"
)
private val ignoredDirectoryNames = setOf(
  "\$recycle.bin", "applications", "library", "lost+found", "music", "node_modules",
  "program files", "program files (x86)", "system", "system volume information", "windows"
)

class PhotoArchiveModule : Module() {
  private var pickerPromise: Promise? = null

  private data class ScanState(
    var scannedItems: Int = 0,
    var totalItems: Int? = null,
    val pendingPhotos: MutableList<Map<String, Any?>> = mutableListOf()
  )

  private data class ScannableItem(
    val document: DocumentEntry,
    val relativePath: String
  )

  override fun definition() = ModuleDefinition {
    Name("PhotoArchive")
    Events("onScanProgress")

    AsyncFunction("selectDirectory") { promise: Promise ->
      if (pickerPromise != null) {
        promise.reject("ERR_PICKER_BUSY", "Выбор папки уже открыт", null)
        return@AsyncFunction
      }
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.reject("ERR_NO_ACTIVITY", "Не удалось открыть системный выбор папки", null)
        return@AsyncFunction
      }

      pickerPromise = promise
      val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        addFlags(Intent.FLAG_GRANT_PREFIX_URI_PERMISSION)
      }
      activity.startActivityForResult(intent, PICK_DIRECTORY_REQUEST)
    }.runOnQueue(Queues.MAIN)

    OnActivityResult { _, payload ->
      if (payload.requestCode != PICK_DIRECTORY_REQUEST) return@OnActivityResult
      val promise = pickerPromise ?: return@OnActivityResult
      pickerPromise = null

      if (payload.resultCode != Activity.RESULT_OK) {
        promise.resolve(null)
        return@OnActivityResult
      }
      val resultData = payload.data
      val uri = resultData?.data
      if (resultData == null || uri == null) {
        promise.reject("ERR_DIRECTORY_PICKER", "Системный выбор папки не вернул адрес", null)
        return@OnActivityResult
      }

      try {
        val context = requireNotNull(appContext.reactContext)
        val requestedFlags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
        val grantedFlags = resultData.flags and requestedFlags
        val flags = if (grantedFlags == 0) requestedFlags else grantedFlags
        context.contentResolver.takePersistableUriPermission(uri, flags)
        replaceStoredDirectory(context, uri)
        promise.resolve(directoryInfo(context, uri))
      } catch (error: Exception) {
        promise.reject("ERR_DIRECTORY_ACCESS", error.localizedMessage, error)
      }
    }

    AsyncFunction("getDirectory") {
      val context = requireNotNull(appContext.reactContext)
      val uri = storedDirectory(context) ?: return@AsyncFunction null
      if (!hasPersistedPermission(context, uri)) {
        preferences(context).edit().remove(DIRECTORY_URI_KEY).apply()
        return@AsyncFunction null
      }
      directoryInfo(context, uri)
    }

    AsyncFunction("getCachedPhotos") {
      val context = requireNotNull(appContext.reactContext)
      val uri = storedDirectory(context) ?: return@AsyncFunction null
      readIndexCache(context, uri)
    }

    AsyncFunction("getPreview") { uri: String, cacheKey: String ->
      val context = requireNotNull(appContext.reactContext)
      generatePreview(context, Uri.parse(uri), cacheKey).toString()
    }

    AsyncFunction("getDisplayUri") { uri: String, cacheKey: String ->
      val context = requireNotNull(appContext.reactContext)
      prepareDisplayPhoto(context, Uri.parse(uri), cacheKey).toString()
    }

    AsyncFunction("getPhotoExifLocation") { uri: String ->
      val context = requireNotNull(appContext.reactContext)
      PhotoExifLocation.read(context, Uri.parse(uri))
    }

    AsyncFunction("getViewerMetadata") {
      val context = requireNotNull(appContext.reactContext)
      val treeUri = requireDirectory(context)
      readViewerMetadata(context, treeUri)
    }

    AsyncFunction("saveDiary") { date: String, content: String? ->
      val context = requireNotNull(appContext.reactContext)
      val treeUri = requireWritableDirectory(context)
      saveDiary(context, treeUri, date, content)
    }

    AsyncFunction("setBlurred") { date: String, blurred: Boolean ->
      val context = requireNotNull(appContext.reactContext)
      val treeUri = requireWritableDirectory(context)
      setBlurred(context, treeUri, date, blurred)
    }

    AsyncFunction("setHighlight") { scope: String, period: String, date: String? ->
      val context = requireNotNull(appContext.reactContext)
      val treeUri = requireWritableDirectory(context)
      setHighlight(context, treeUri, scope, period, date)
    }

    AsyncFunction("setPhotoLocation") {
      relativePath: String,
      latitude: Double?,
      longitude: Double?,
      place: String?,
      country: String? ->
      val context = requireNotNull(appContext.reactContext)
      val treeUri = requireWritableDirectory(context)
      setPhotoLocation(
        context,
        treeUri,
        relativePath,
        latitude,
        longitude,
        place,
        country
      )
    }

    AsyncFunction("movePhoto") { uri: String, relativePath: String, targetRelativePath: String ->
      val context = requireNotNull(appContext.reactContext)
      val treeUri = requireWritableDirectory(context)
      movePhoto(context, treeUri, uri, relativePath, targetRelativePath)
    }

    AsyncFunction("deletePhoto") { uri: String, relativePath: String ->
      val context = requireNotNull(appContext.reactContext)
      val treeUri = requireWritableDirectory(context)
      deletePhoto(context, treeUri, uri, relativePath)
    }

    AsyncFunction("listPhotos") {
      val context = requireNotNull(appContext.reactContext)
      val uri = storedDirectory(context)
        ?: throw IllegalStateException("Сначала выберите папку фотоархива")
      if (!hasPersistedPermission(context, uri)) {
        throw SecurityException("Доступ к папке закончился; выберите её снова")
      }
      val photos = scanPhotos(context, uri)
      writeIndexCache(context, uri, photos)
      photos
    }

    AsyncFunction("clearDirectory") {
      val context = requireNotNull(appContext.reactContext)
      val uri = storedDirectory(context)
      if (uri != null) {
        try {
          context.contentResolver.releasePersistableUriPermission(
            uri,
            Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
          )
        } catch (_: SecurityException) {
          // Разрешение могло быть уже отозвано в системных настройках.
        }
      }
      preferences(context).edit().remove(DIRECTORY_URI_KEY).apply()
      indexCacheFile(context).delete()
      displayCacheRoot(context).deleteRecursively()
      previewCacheRoot(context).deleteRecursively()
    }
  }

  private fun preferences(context: Context) =
    context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

  private fun storedDirectory(context: Context): Uri? =
    preferences(context).getString(DIRECTORY_URI_KEY, null)?.let(Uri::parse)

  private fun hasPersistedPermission(context: Context, uri: Uri): Boolean =
    context.contentResolver.persistedUriPermissions.any {
      it.isReadPermission && it.uri == uri
    }

  private fun hasPersistedWritePermission(context: Context, uri: Uri): Boolean =
    context.contentResolver.persistedUriPermissions.any {
      it.isReadPermission && it.isWritePermission && it.uri == uri
    }

  private fun requireDirectory(context: Context): Uri {
    val uri = storedDirectory(context)
      ?: throw IllegalStateException("Сначала выберите папку фотоархива")
    if (!hasPersistedPermission(context, uri)) {
      throw SecurityException("Доступ к папке закончился; выберите её снова")
    }
    return uri
  }

  private fun requireWritableDirectory(context: Context): Uri {
    val uri = requireDirectory(context)
    if (!hasPersistedWritePermission(context, uri)) {
      throw SecurityException("Для изменения архива выберите эту папку повторно и разрешите запись")
    }
    return uri
  }

  private fun replaceStoredDirectory(context: Context, uri: Uri) {
    val previous = storedDirectory(context)
    if (previous != null && previous != uri) {
      try {
        context.contentResolver.releasePersistableUriPermission(
          previous,
          Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
        )
      } catch (_: SecurityException) {
        // Старое разрешение уже недействительно.
      }
    }
    preferences(context).edit().putString(DIRECTORY_URI_KEY, uri.toString()).apply()
  }

  private fun directoryInfo(context: Context, treeUri: Uri): Map<String, Any?> = mapOf(
    "name" to documentName(context, treeUri),
    "persistent" to true,
    "platform" to "android",
    "uri" to treeUri.toString()
  )

  private fun documentName(context: Context, treeUri: Uri): String {
    return try {
      val documentId = DocumentsContract.getTreeDocumentId(treeUri)
      val documentUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, documentId)
      context.contentResolver.query(
        documentUri,
        arrayOf(OpenableColumns.DISPLAY_NAME),
        null,
        null,
        null
      )?.use { cursor ->
        if (cursor.moveToFirst()) cursor.getString(0) else null
      } ?: "Фотоархив"
    } catch (_: Exception) {
      "Фотоархив"
    }
  }

  private fun rootDocumentUri(treeUri: Uri): Uri = DocumentsContract.buildDocumentUriUsingTree(
    treeUri,
    DocumentsContract.getTreeDocumentId(treeUri)
  )

  private fun safeRelativePath(value: String): String {
    val normalized = value.replace('\\', '/').trim('/')
    val parts = normalized.split('/')
    require(normalized.isNotEmpty() && !value.startsWith('/') && parts.none {
      it.isEmpty() || it == "." || it == ".."
    }) { "Некорректный путь внутри фотоархива" }
    return normalized
  }

  private data class DocumentEntry(
    val id: String,
    val mimeType: String,
    val modifiedAt: Long?,
    val name: String,
    val uri: Uri
  )

  private fun childDocuments(context: Context, treeUri: Uri, parentId: String): List<DocumentEntry> {
    val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, parentId)
    val projection = arrayOf(
      DocumentsContract.Document.COLUMN_DOCUMENT_ID,
      DocumentsContract.Document.COLUMN_DISPLAY_NAME,
      DocumentsContract.Document.COLUMN_MIME_TYPE,
      DocumentsContract.Document.COLUMN_LAST_MODIFIED
    )
    return context.contentResolver.query(childrenUri, projection, null, null, null)?.use { cursor ->
      val idColumn = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DOCUMENT_ID)
      val nameColumn = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DISPLAY_NAME)
      val mimeColumn = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_MIME_TYPE)
      val modifiedColumn = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_LAST_MODIFIED)
      buildList {
        while (cursor.moveToNext()) {
          val id = cursor.getString(idColumn)
          val name = cursor.getString(nameColumn) ?: continue
          add(DocumentEntry(
            id = id,
            mimeType = cursor.getString(mimeColumn) ?: "",
            modifiedAt = if (cursor.isNull(modifiedColumn)) null else cursor.getLong(modifiedColumn),
            name = name,
            uri = DocumentsContract.buildDocumentUriUsingTree(treeUri, id)
          ))
        }
      }
    } ?: emptyList()
  }

  private fun findDocument(context: Context, treeUri: Uri, relativePath: String): DocumentEntry? {
    val parts = safeRelativePath(relativePath).split('/')
    var parentId = DocumentsContract.getTreeDocumentId(treeUri)
    var current: DocumentEntry? = null
    for (part in parts) {
      current = childDocuments(context, treeUri, parentId).firstOrNull { it.name == part }
        ?: return null
      parentId = current.id
    }
    return current
  }

  private fun ensureDirectory(
    context: Context,
    treeUri: Uri,
    relativeParts: List<String>
  ): DocumentEntry {
    var parent = DocumentEntry(
      id = DocumentsContract.getTreeDocumentId(treeUri),
      mimeType = DocumentsContract.Document.MIME_TYPE_DIR,
      modifiedAt = null,
      name = documentName(context, treeUri),
      uri = rootDocumentUri(treeUri)
    )
    for (part in relativeParts) {
      val existing = childDocuments(context, treeUri, parent.id).firstOrNull { it.name == part }
      if (existing != null) {
        require(existing.mimeType == DocumentsContract.Document.MIME_TYPE_DIR) {
          "«$part» уже существует и не является папкой"
        }
        parent = existing
      } else {
        val created = DocumentsContract.createDocument(
          context.contentResolver,
          parent.uri,
          DocumentsContract.Document.MIME_TYPE_DIR,
          part
        ) ?: throw IllegalStateException("Не удалось создать папку «$part»")
        parent = DocumentEntry(
          id = DocumentsContract.getDocumentId(created),
          mimeType = DocumentsContract.Document.MIME_TYPE_DIR,
          modifiedAt = null,
          name = part,
          uri = created
        )
      }
    }
    return parent
  }

  private fun readText(context: Context, uri: Uri): String? = try {
    context.contentResolver.openInputStream(uri)?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }
  } catch (_: Exception) {
    null
  }

  private fun writeText(context: Context, uri: Uri, value: String) {
    context.contentResolver.openOutputStream(uri, "wt")?.bufferedWriter(Charsets.UTF_8)?.use {
      it.write(value)
    } ?: throw IllegalStateException("Хранилище не разрешило запись файла")
  }

  private fun readJsonObject(context: Context, entry: DocumentEntry?): JSONObject = try {
    if (entry == null) JSONObject() else JSONObject(readText(context, entry.uri) ?: "{}")
  } catch (_: Exception) {
    JSONObject()
  }

  private fun writeJsonFile(
    context: Context,
    treeUri: Uri,
    fileName: String,
    value: Any
  ) {
    val existing = findDocument(context, treeUri, fileName)
    val target = existing?.uri ?: DocumentsContract.createDocument(
      context.contentResolver,
      rootDocumentUri(treeUri),
      "application/json",
      fileName
    ) ?: throw IllegalStateException("Не удалось создать $fileName")
    val json = when (value) {
      is JSONObject -> value.toString(2)
      is JSONArray -> value.toString(2)
      else -> throw IllegalArgumentException("Неподдерживаемый JSON")
    }
    writeText(context, target, "$json\n")
  }

  private fun validDate(value: String): Boolean {
    if (!Regex("^(?:19|20)\\d{2}-\\d{2}-\\d{2}$").matches(value)) return false
    return try {
      SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { isLenient = false }.parse(value) != null
    } catch (_: Exception) {
      false
    }
  }

  private fun jsonMap(value: JSONObject): Map<String, Any?> = buildMap {
    value.keys().forEach { key ->
      put(key, when (val item = value.opt(key)) {
        is JSONObject -> jsonMap(item)
        is JSONArray -> List(item.length()) { index -> item.opt(index) }
        JSONObject.NULL -> null
        else -> item
      })
    }
  }

  private fun readViewerMetadata(context: Context, treeUri: Uri): Map<String, Any?> {
    val diaries = mutableMapOf<String, String>()
    val diaryRoot = findDocument(context, treeUri, "_diary")
    if (diaryRoot?.mimeType == DocumentsContract.Document.MIME_TYPE_DIR) {
      for (entry in childDocuments(context, treeUri, diaryRoot.id)) {
        if (!entry.name.lowercase(Locale.ROOT).endsWith(".md")) continue
        val date = entry.name.removeSuffix(".md").replace('.', '-')
        val content = readText(context, entry.uri)
        if (validDate(date) && content != null) diaries[date] = content
      }
    }

    val blurEntry = findDocument(context, treeUri, "presentation_blur_dates.json")
    val blurDates = try {
      val value = JSONArray(blurEntry?.let { readText(context, it.uri) } ?: "[]")
      List(value.length()) { value.optString(it) }.filter(::validDate).sorted()
    } catch (_: Exception) {
      emptyList()
    }
    val highlights = readJsonObject(
      context,
      findDocument(context, treeUri, "period_photo_selections.json")
    )
    val locationsDocument = readJsonObject(
      context,
      findDocument(context, treeUri, "photo_locations.json")
    )
    val locations = locationsDocument.optJSONObject("photos")
      ?: if (!locationsDocument.has("version")) locationsDocument else JSONObject()
    return mapOf(
      "blurDates" to blurDates,
      "diaries" to diaries,
      "highlights" to mapOf(
        "months" to jsonMap(highlights.optJSONObject("months") ?: JSONObject()),
        "years" to jsonMap(highlights.optJSONObject("years") ?: JSONObject())
      ),
      "locations" to jsonMap(locations)
    )
  }

  private fun saveDiary(context: Context, treeUri: Uri, date: String, content: String?) {
    require(validDate(date)) { "Дата заметки должна быть в формате ГГГГ-ММ-ДД" }
    require((content?.length ?: 0) <= 500_000) { "Заметка слишком большая" }
    val fileName = "${date.replace('-', '.')}.md"
    val diaryRoot = findDocument(context, treeUri, "_diary")
    val existing = diaryRoot?.let { parent ->
      if (parent.mimeType == DocumentsContract.Document.MIME_TYPE_DIR) {
        childDocuments(context, treeUri, parent.id).firstOrNull { it.name == fileName }
      } else null
    }
    if (content.isNullOrBlank()) {
      if (existing != null) DocumentsContract.deleteDocument(context.contentResolver, existing.uri)
      return
    }
    val parent = diaryRoot ?: ensureDirectory(context, treeUri, listOf("_diary"))
    val target = existing?.uri ?: DocumentsContract.createDocument(
      context.contentResolver,
      parent.uri,
      "text/markdown",
      fileName
    ) ?: throw IllegalStateException("Не удалось создать файл заметки")
    writeText(context, target, content)
  }

  private fun setBlurred(context: Context, treeUri: Uri, date: String, blurred: Boolean) {
    require(validDate(date)) { "Дата должна быть в формате ГГГГ-ММ-ДД" }
    val existing = findDocument(context, treeUri, "presentation_blur_dates.json")
    val values = try {
      val source = JSONArray(existing?.let { readText(context, it.uri) } ?: "[]")
      MutableList(source.length()) { source.optString(it) }.filter(::validDate).toMutableSet()
    } catch (_: Exception) {
      mutableSetOf()
    }
    if (blurred) values.add(date) else values.remove(date)
    writeJsonFile(context, treeUri, "presentation_blur_dates.json", JSONArray(values.sorted()))
  }

  private fun setHighlight(
    context: Context,
    treeUri: Uri,
    scope: String,
    period: String,
    date: String?
  ) {
    require(scope == "month" || scope == "year") { "Неизвестный тип отметки периода" }
    require(date == null || validDate(date) && date.startsWith("$period-")) {
      "Фотография не относится к выбранному периоду"
    }
    val document = readJsonObject(
      context,
      findDocument(context, treeUri, "period_photo_selections.json")
    )
    val years = document.optJSONObject("years") ?: JSONObject()
    val months = document.optJSONObject("months") ?: JSONObject()
    val values = if (scope == "month") months else years
    if (date == null) values.remove(period) else values.put(period, date)
    writeJsonFile(
      context,
      treeUri,
      "period_photo_selections.json",
      JSONObject().put("years", years).put("months", months)
    )
  }

  private fun setPhotoLocation(
    context: Context,
    treeUri: Uri,
    relativePath: String,
    latitude: Double?,
    longitude: Double?,
    place: String?,
    country: String?
  ) {
    val path = safeRelativePath(relativePath)
    require(
      latitude == null && longitude == null
        || latitude != null && longitude != null
        && latitude in -90.0..90.0 && longitude in -180.0..180.0
    ) { "Укажите корректные широту и долготу" }
    val document = readJsonObject(context, findDocument(context, treeUri, "photo_locations.json"))
    val photos = document.optJSONObject("photos")
      ?: if (!document.has("version")) document else JSONObject()
    if (latitude == null || longitude == null) {
      photos.remove(path)
    } else {
      val location = JSONObject()
        .put("latitude", latitude)
        .put("longitude", longitude)
        .put("source", "manual")
      place?.trim()?.takeIf { it.isNotEmpty() }?.let { location.put("place", it.take(240)) }
      country?.trim()?.takeIf { it.isNotEmpty() }?.let { location.put("country", it.take(120)) }
      photos.put(path, location)
    }
    val next = if (document.has("version")) document else JSONObject()
    next.put("version", 2).put("photos", photos)
    writeJsonFile(context, treeUri, "photo_locations.json", next)
  }

  private fun uniqueFileName(existingNames: Set<String>, requested: String): String {
    if (!existingNames.contains(requested)) return requested
    val extensionIndex = requested.lastIndexOf('.')
    val extension = if (extensionIndex > 0) requested.substring(extensionIndex) else ""
    val stem = if (extension.isEmpty()) requested else requested.substring(0, extensionIndex)
    for (sequence in 2..9_999) {
      val candidate = "$stem ($sequence)$extension"
      if (!existingNames.contains(candidate)) return candidate
    }
    throw IllegalStateException("Не удалось подобрать свободное имя")
  }

  private fun movePhoto(
    context: Context,
    treeUri: Uri,
    uri: String,
    relativePath: String,
    targetRelativePath: String
  ): Map<String, Any?> {
    val sourcePath = safeRelativePath(relativePath)
    val targetPath = safeRelativePath(targetRelativePath)
    val source = findDocument(context, treeUri, sourcePath)
      ?: throw IllegalStateException("Оригинал фотографии больше не существует")
    require(source.uri == Uri.parse(uri)) { "Фотография изменилась после индексирования" }
    val targetParts = targetPath.split('/')
    val parent = ensureDirectory(context, treeUri, targetParts.dropLast(1))
    val existingNames = childDocuments(context, treeUri, parent.id).map { it.name }.toSet()
    val targetName = uniqueFileName(existingNames, targetParts.last())
    val extension = targetName.substringAfterLast('.', "").lowercase(Locale.ROOT)
    val mimeType = if (extension.isEmpty()) "application/octet-stream" else "image/$extension"
    val destination = DocumentsContract.createDocument(
      context.contentResolver,
      parent.uri,
      mimeType,
      targetName
    ) ?: throw IllegalStateException("Не удалось создать файл назначения")
    try {
      context.contentResolver.openInputStream(source.uri)?.use { input ->
        context.contentResolver.openOutputStream(destination, "w")?.use { output ->
          input.copyTo(output)
        } ?: throw IllegalStateException("Хранилище не разрешило запись файла")
      } ?: throw IllegalStateException("Хранилище не разрешило чтение фотографии")
      if (!DocumentsContract.deleteDocument(context.contentResolver, source.uri)) {
        throw IllegalStateException("Не удалось удалить исходный файл после копирования")
      }
    } catch (error: Exception) {
      try { DocumentsContract.deleteDocument(context.contentResolver, destination) } catch (_: Exception) {}
      throw error
    }
    indexCacheFile(context).delete()
    val actualPath = (targetParts.dropLast(1) + targetName).joinToString("/")
    return mapOf(
      "modifiedAt" to Date().time,
      "name" to targetName,
      "relativePath" to actualPath,
      "uri" to destination.toString()
    )
  }

  private fun deletePhoto(context: Context, treeUri: Uri, uri: String, relativePath: String) {
    val source = findDocument(context, treeUri, safeRelativePath(relativePath))
      ?: throw IllegalStateException("Оригинал фотографии больше не существует")
    require(source.uri == Uri.parse(uri)) { "Фотография изменилась после индексирования" }
    check(DocumentsContract.deleteDocument(context.contentResolver, source.uri)) {
      "Хранилище не удалило фотографию"
    }
    indexCacheFile(context).delete()
  }

  private fun scanPhotos(context: Context, treeUri: Uri): List<Map<String, Any?>> {
    val rootId = DocumentsContract.getTreeDocumentId(treeUri)
    val photos = mutableListOf<Map<String, Any?>>()
    val state = ScanState()
    sendScanProgress("starting", state, photos.size)
    sendScanProgress("counting", state, photos.size)
    val items = mutableListOf<ScannableItem>()
    collectScannableItems(context, treeUri, rootId, "", items)
    state.totalItems = items.size
    sendScanProgress("scanning", state, photos.size)
    scanItems(items, photos, state)
    sendScanProgress("complete", state, photos.size, flushPhotos = true)
    return photos
  }

  private fun collectScannableItems(
    context: Context,
    treeUri: Uri,
    parentId: String,
    parentPath: String,
    items: MutableList<ScannableItem>
  ) {
    for (entry in childDocuments(context, treeUri, parentId)) {
      val relativePath = if (parentPath.isEmpty()) entry.name else "$parentPath/${entry.name}"
      items.add(ScannableItem(entry, relativePath))
      if (entry.mimeType != DocumentsContract.Document.MIME_TYPE_DIR) continue
      val normalizedName = entry.name.lowercase(Locale.ROOT)
      if (!entry.name.startsWith('.') && !ignoredDirectoryNames.contains(normalizedName)) {
        collectScannableItems(context, treeUri, entry.id, relativePath, items)
      }
    }
  }

  private fun scanItems(
    items: List<ScannableItem>,
    photos: MutableList<Map<String, Any?>>,
    state: ScanState
  ) {
    val progressItemInterval = maxOf(1, (items.size + PROGRESS_UPDATE_COUNT - 1) / PROGRESS_UPDATE_COUNT)
    for (item in items) {
      state.scannedItems += 1
      val document = item.document
      if (document.mimeType != DocumentsContract.Document.MIME_TYPE_DIR) {
        val extension = document.name.substringAfterLast('.', "").lowercase(Locale.ROOT)
        if (document.mimeType.startsWith("image/") || imageExtensions.contains(extension)) {
          val photo = mapOf(
            "modifiedAt" to document.modifiedAt,
            "name" to document.name,
            "relativePath" to item.relativePath,
            "uri" to document.uri.toString()
          )
          photos.add(photo)
          state.pendingPhotos.add(photo)
        }
      }
      if (
        state.pendingPhotos.size >= PROGRESS_PHOTO_BATCH_SIZE ||
        state.scannedItems % progressItemInterval == 0
      ) {
        sendScanProgress("scanning", state, photos.size, flushPhotos = true)
      }
    }
  }

  private fun sendScanProgress(
    phase: String,
    state: ScanState,
    foundPhotos: Int,
    flushPhotos: Boolean = false
  ) {
    val batch = if (flushPhotos) state.pendingPhotos.toList() else emptyList()
    if (flushPhotos) state.pendingPhotos.clear()
    val payload = mutableMapOf<String, Any?>(
      "phase" to phase,
      "scannedItems" to state.scannedItems,
      "foundPhotos" to foundPhotos,
      "photos" to batch
    )
    state.totalItems?.let { payload["totalItems"] = it }
    sendEvent(
      PROGRESS_EVENT_NAME,
      payload
    )
  }

  private fun indexCacheFile(context: Context) = File(context.filesDir, INDEX_CACHE_NAME)

  private fun readIndexCache(context: Context, treeUri: Uri): List<Map<String, Any?>>? {
    return try {
      val payload = JSONObject(indexCacheFile(context).readText())
      if (payload.optString("rootURI") != treeUri.toString()) return null
      val values = payload.getJSONArray("photos")
      List(values.length()) { index ->
        val value = values.getJSONObject(index)
        mapOf(
          "modifiedAt" to if (value.isNull("modifiedAt")) null else value.optLong("modifiedAt"),
          "name" to value.getString("name"),
          "relativePath" to value.getString("relativePath"),
          "uri" to value.getString("uri")
        )
      }
    } catch (_: Exception) {
      null
    }
  }

  private fun writeIndexCache(
    context: Context,
    treeUri: Uri,
    photos: List<Map<String, Any?>>
  ) {
    val values = JSONArray()
    photos.forEach { photo ->
      values.put(JSONObject(photo))
    }
    val payload = JSONObject()
      .put("rootURI", treeUri.toString())
      .put("photos", values)
    val destination = indexCacheFile(context)
    val temporary = File(destination.parentFile, "${destination.name}.tmp")
    temporary.writeText(payload.toString())
    if (!temporary.renameTo(destination)) {
      temporary.copyTo(destination, overwrite = true)
      temporary.delete()
    }
  }

  private fun generatePreview(context: Context, source: Uri, cacheKey: String): Uri {
    val cacheRoot = previewCacheRoot(context)
    cacheRoot.mkdirs()
    val digest = MessageDigest.getInstance("SHA-256")
      .digest(cacheKey.toByteArray(Charsets.UTF_8))
      .joinToString("") { "%02x".format(it) }
    val destination = File(cacheRoot, "$digest.jpg")
    if (destination.isFile && destination.length() > 0) return Uri.fromFile(destination)

    val bitmap = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      context.contentResolver.loadThumbnail(source, Size(480, 480), null)
    } else {
      decodeSampledBitmap(context, source, 480)
    }
    val temporary = File(cacheRoot, ".$digest.tmp")
    try {
      FileOutputStream(temporary).use { output ->
        check(bitmap.compress(Bitmap.CompressFormat.JPEG, 72, output)) {
          "Не удалось закодировать превью фотографии"
        }
      }
      if (!temporary.renameTo(destination)) {
        temporary.copyTo(destination, overwrite = true)
        temporary.delete()
      }
    } finally {
      bitmap.recycle()
      temporary.delete()
    }
    return Uri.fromFile(destination)
  }

  private fun prepareDisplayPhoto(context: Context, source: Uri, cacheKey: String): Uri {
    val cacheRoot = displayCacheRoot(context)
    cacheRoot.mkdirs()
    val digest = MessageDigest.getInstance("SHA-256")
      .digest(cacheKey.toByteArray(Charsets.UTF_8))
      .joinToString("") { "%02x".format(it) }
    val extension = source.lastPathSegment
      ?.substringAfterLast('.', "img")
      ?.lowercase(Locale.ROOT)
      ?.takeIf { it.matches(Regex("[a-z0-9]{1,8}")) }
      ?: "img"
    val destination = File(cacheRoot, "$digest.$extension")
    if (destination.isFile && destination.length() > 0) return Uri.fromFile(destination)
    val temporary = File(cacheRoot, ".$digest.tmp")
    try {
      context.contentResolver.openInputStream(source)?.use { input ->
        FileOutputStream(temporary).use { output -> input.copyTo(output) }
      } ?: throw IllegalStateException("Хранилище не разрешило чтение фотографии")
      check(temporary.length() > 0) { "Фотография пока не загружена из хранилища" }
      if (!temporary.renameTo(destination)) {
        temporary.copyTo(destination, overwrite = true)
        temporary.delete()
      }
    } finally {
      temporary.delete()
    }
    return Uri.fromFile(destination)
  }

  private fun previewCacheRoot(context: Context) = File(context.cacheDir, PREVIEW_CACHE_NAME)

  private fun displayCacheRoot(context: Context) = File(context.cacheDir, DISPLAY_CACHE_NAME)

  private fun decodeSampledBitmap(context: Context, source: Uri, maximumSize: Int): Bitmap {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    context.contentResolver.openInputStream(source)?.use {
      BitmapFactory.decodeStream(it, null, bounds)
    }
    var sampleSize = 1
    while (bounds.outWidth / sampleSize > maximumSize * 2 || bounds.outHeight / sampleSize > maximumSize * 2) {
      sampleSize *= 2
    }
    val options = BitmapFactory.Options().apply { inSampleSize = sampleSize }
    return context.contentResolver.openInputStream(source)?.use {
      BitmapFactory.decodeStream(it, null, options)
    } ?: throw IllegalStateException("Не удалось декодировать фотографию")
  }
}
