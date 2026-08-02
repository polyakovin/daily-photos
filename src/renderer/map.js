(function exposePhotoDayMap(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PhotoDayMap = api;
}(typeof globalThis === 'object' ? globalThis : this, () => {
  const TILE_SIZE = 256;
  const MAX_LATITUDE = 85.05112878;
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 18;
  const MAP_COORDINATE_DIGITS = 5;
  const MAX_PHOTO_STACK_SIZE = 30;
  const WHEEL_ZOOM_THRESHOLD = 90;
  const WHEEL_ZOOM_COOLDOWN = 150;

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function normalizeLongitude(value) {
    const longitude = Number(value);
    if (!Number.isFinite(longitude)) return 0;
    return ((longitude + 180) % 360 + 360) % 360 - 180;
  }

  function normalizeCoordinates(value) {
    if (
      value?.latitude === null
      || value?.latitude === undefined
      || value?.latitude === ''
      || value?.longitude === null
      || value?.longitude === undefined
      || value?.longitude === ''
    ) return null;
    const latitude = Number(value?.latitude);
    const longitude = Number(value?.longitude);
    if (
      !Number.isFinite(latitude)
      || !Number.isFinite(longitude)
      || latitude < -90
      || latitude > 90
      || longitude < -180
      || longitude > 180
    ) return null;
    return { latitude, longitude };
  }

  function project(latitude, longitude, zoom) {
    const size = TILE_SIZE * (2 ** zoom);
    const safeLatitude = clamp(Number(latitude) || 0, -MAX_LATITUDE, MAX_LATITUDE);
    const sine = Math.sin(safeLatitude * Math.PI / 180);
    return {
      x: (normalizeLongitude(longitude) + 180) / 360 * size,
      y: (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * size
    };
  }

  function unproject(x, y, zoom) {
    const size = TILE_SIZE * (2 ** zoom);
    const longitude = normalizeLongitude(x / size * 360 - 180);
    const mercator = Math.PI - 2 * Math.PI * clamp(y, 0, size) / size;
    const latitude = 180 / Math.PI * Math.atan(Math.sinh(mercator));
    return { latitude, longitude };
  }

  function pointCoordinates(point) {
    return normalizeCoordinates(point);
  }

  function displayCoordinates(value) {
    const coordinates = normalizeCoordinates(value);
    if (!coordinates) return null;
    return {
      latitude: Number(coordinates.latitude.toFixed(MAP_COORDINATE_DIGITS)),
      longitude: Number(coordinates.longitude.toFixed(MAP_COORDINATE_DIGITS))
    };
  }

  function mapCoordinateKey(value) {
    const coordinates = displayCoordinates(value);
    return coordinates
      ? `${coordinates.latitude.toFixed(MAP_COORDINATE_DIGITS)}:${coordinates.longitude.toFixed(MAP_COORDINATE_DIGITS)}`
      : '';
  }

  function markerCellSize(zoom) {
    return zoom >= 13 ? 42 : zoom >= 7 ? 48 : 56;
  }

  function mapClusterKey(value, zoom, cellSize = markerCellSize(zoom)) {
    const coordinates = displayCoordinates(value);
    if (!coordinates) return '';
    const world = project(coordinates.latitude, coordinates.longitude, zoom);
    return `${zoom}:${Math.floor(world.x / cellSize)}:${Math.floor(world.y / cellSize)}`;
  }

  function maxZoomClusterKey(value) {
    return mapClusterKey(value, MAX_ZOOM);
  }

  function linkedReferencePlaces(places, photos) {
    const linkedReferenceIds = new Set(
      (Array.isArray(photos) ? photos : [])
        .map((photo) => photo.locationReferenceId)
        .filter(Boolean)
    );
    return (Array.isArray(places) ? places : [])
      .filter((place) => linkedReferenceIds.has(place.id));
  }

  function referencePlaceSuggestions(places, photos, limit = 6, recentPlaceIds = []) {
    const stats = (Array.isArray(places) ? places : []).map((place, index) => ({ place, index }));
    const statsById = new Map();
    const groups = [];
    const groupsByCluster = new Map();
    const groupsByStat = new Map();
    for (const stat of stats) {
      if (stat.place?.id) statsById.set(stat.place.id, stat);
      const clusterKey = maxZoomClusterKey(stat.place);
      let group = clusterKey ? groupsByCluster.get(clusterKey) : null;
      if (!group) {
        group = {
          key: clusterKey || `place:${stat.place?.id || stat.index}`,
          stats: [],
          photoCount: 0,
          latestDate: ''
        };
        groups.push(group);
        if (clusterKey) groupsByCluster.set(clusterKey, group);
      }
      group.stats.push(stat);
      groupsByStat.set(stat, group);
    }

    for (const photo of Array.isArray(photos) ? photos : []) {
      const matchingGroups = new Set();
      const linkedStat = statsById.get(photo?.locationReferenceId);
      if (linkedStat) matchingGroups.add(groupsByStat.get(linkedStat));
      const clusterKey = maxZoomClusterKey(photo);
      const coordinateGroup = groupsByCluster.get(clusterKey);
      if (coordinateGroup) matchingGroups.add(coordinateGroup);
      for (const group of matchingGroups) {
        group.photoCount += 1;
        const date = typeof photo?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(photo.date)
          ? photo.date
          : '';
        if (date > group.latestDate) group.latestDate = date;
      }
    }

    const suggestionFromStat = (stat) => {
      const group = groupsByStat.get(stat);
      return {
        place: stat.place,
        photoCount: group.photoCount,
        latestDate: group.latestDate
      };
    };
    const compareNames = (a, b) => (
      String(a.place?.name || '').localeCompare(String(b.place?.name || ''), 'ru')
      || String(a.place?.country || '').localeCompare(String(b.place?.country || ''), 'ru')
    );
    const safeLimit = Math.max(0, Math.trunc(Number(limit) || 0));
    const recent = [];
    const recentIds = new Set();
    const recentGroups = new Set();
    for (const placeId of Array.isArray(recentPlaceIds) ? recentPlaceIds : []) {
      if (recentIds.has(placeId)) continue;
      recentIds.add(placeId);
      const stat = statsById.get(placeId);
      const group = groupsByStat.get(stat);
      if (group && !recentGroups.has(group.key)) {
        recentGroups.add(group.key);
        recent.push(suggestionFromStat(stat));
      }
      if (recent.length >= safeLimit) break;
    }
    return {
      all: stats.map(suggestionFromStat).sort(compareNames),
      recent,
      popular: groups.filter(({ photoCount }) => photoCount > 0).map((group) => ({
        place: group.stats[0].place,
        photoCount: group.photoCount,
        latestDate: group.latestDate
      })).sort((a, b) => (
        b.photoCount - a.photoCount
        || compareNames(a, b)
      )).slice(0, safeLimit)
    };
  }

  function visibleReferencePoints(places, photos) {
    const locatedPhotos = (Array.isArray(photos) ? photos : [])
      .filter((photo) => mapCoordinateKey(photo));
    const photoCoordinateKeys = new Set(locatedPhotos.map(mapCoordinateKey));
    return (Array.isArray(places) ? places : [])
      .filter((place) => !photoCoordinateKeys.has(mapCoordinateKey(place)))
      .map((place) => ({ ...place, mapPointType: 'reference' }));
  }

  function parseCoordinateQuery(value) {
    const query = String(value || '').trim().replace(/^geo:/i, '');
    let match = query.match(
      /^([+-]?(?:\d{1,2}(?:\.\d+)?|90(?:\.0+)?))\s*[,;\s]\s*([+-]?(?:\d{1,3}(?:\.\d+)?|180(?:\.0+)?))$/
    );
    if (!match) {
      match = query.match(
        /^([+-]?\d{1,2}),(\d+)\s+([+-]?\d{1,3}),(\d+)$/
      );
      if (match) {
        match = [match[0], `${match[1]}.${match[2]}`, `${match[3]}.${match[4]}`];
      }
    }
    return match
      ? normalizeCoordinates({ latitude: match[1], longitude: match[2] })
      : null;
  }

  function clusterProjectedPoints(points, zoom, cellSize) {
    const groups = new Map();
    for (const point of Array.isArray(points) ? points : []) {
      const location = displayCoordinates(point);
      if (!location) continue;
      const world = project(location.latitude, location.longitude, zoom);
      const cellX = Math.floor(world.x / cellSize);
      const cellY = Math.floor(world.y / cellSize);
      const key = `${zoom}:${cellX}:${cellY}`;
      const group = groups.get(key) || {
        key,
        points: [],
        worldX: 0,
        worldY: 0
      };
      group.points.push(point);
      group.worldX += world.x;
      group.worldY += world.y;
      groups.set(key, group);
    }
    return [...groups.values()].map((group) => ({
      ...group,
      worldX: group.worldX / group.points.length,
      worldY: group.worldY / group.points.length
    }));
  }

  function distinctMapPointCount(points) {
    return new Set(
      (Array.isArray(points) ? points : []).map(maxZoomClusterKey).filter(Boolean)
    ).size;
  }

  function photoStackPoints(points, random = Math.random) {
    const locatedPoints = (Array.isArray(points) ? points : [])
      .filter((point) => pointCoordinates(point));
    const photos = locatedPoints
      .filter((point) => (
        point.mapPointType === 'photo'
        && (point.thumbnailSrc || point.src)
      ))
      .sort((a, b) => (
        String(b.date || '').localeCompare(String(a.date || ''))
        || String(a.id || '').localeCompare(String(b.id || ''))
    ));
    if (photos.length < 2) return [];
    if (photos.length <= MAX_PHOTO_STACK_SIZE) return photos;

    const shuffled = [...photos];
    for (let index = 0; index < MAX_PHOTO_STACK_SIZE; index += 1) {
      const remaining = shuffled.length - index;
      const randomValue = Number(random());
      const offset = Math.min(
        remaining - 1,
        Math.max(0, Math.floor((Number.isFinite(randomValue) ? randomValue : 0) * remaining))
      );
      const selectedIndex = index + offset;
      [shuffled[index], shuffled[selectedIndex]] = [shuffled[selectedIndex], shuffled[index]];
    }
    return shuffled.slice(0, MAX_PHOTO_STACK_SIZE);
  }

  function photoFanLayout(total, index) {
    const photoCount = Math.max(1, Math.floor(Number(total) || 1));
    const photoIndex = clamp(Math.floor(Number(index) || 0), 0, photoCount - 1);
    let ring = 0;
    let ringStart = 0;
    let ringCount = 0;

    while (ringStart < photoCount) {
      const capacity = 7 + ring * 3;
      ringCount = Math.min(capacity, photoCount - ringStart);
      if (photoIndex < ringStart + ringCount) break;
      ringStart += ringCount;
      ring += 1;
    }

    const indexInRing = photoIndex - ringStart;
    const spread = ringCount <= 1 ? 0 : Math.min(150, 34 * (ringCount - 1));
    const angle = ringCount <= 1
      ? 0
      : -spread / 2 + spread * indexInRing / (ringCount - 1);
    const radius = 124 + ring * 78;
    const radians = angle * Math.PI / 180;

    return {
      x: Math.sin(radians) * radius,
      y: -Math.cos(radians) * radius,
      angle: angle * 0.22,
      ring
    };
  }

  class InteractiveMap {
    constructor(container, options = {}) {
      if (!container) throw new Error('Не указан контейнер карты');
      this.container = container;
      this.options = options;
      this.center = normalizeCoordinates(options.center) || { latitude: 30, longitude: 20 };
      this.zoom = clamp(Math.round(Number(options.zoom) || 2), MIN_ZOOM, MAX_ZOOM);
      this.points = [];
      this.selection = null;
      this.selectionMode = Boolean(options.selectionMode);
      this.tileNodes = new Map();
      this.markerNodes = new Map();
      this.frame = 0;
      this.pointer = null;
      this.wheelAccumulator = 0;
      this.wheelDirection = 0;
      this.lastWheelZoomAt = 0;
      this.wheelResetTimer = 0;
      this.previewKey = null;
      this.destroyed = false;

      this.tileLayer = document.createElement('div');
      this.tileLayer.className = 'geo-map-tiles';
      this.markerLayer = document.createElement('div');
      this.markerLayer.className = 'geo-map-markers';
      this.selectionLayer = document.createElement('div');
      this.selectionLayer.className = 'geo-map-selection-layer';
      this.preview = document.createElement('aside');
      this.preview.className = 'geo-map-hover-preview';
      this.preview.hidden = true;
      this.previewImage = document.createElement('img');
      this.previewImage.alt = '';
      this.previewCopy = document.createElement('span');
      this.previewTitle = document.createElement('strong');
      this.previewSubtitle = document.createElement('small');
      this.previewCopy.replaceChildren(this.previewTitle, this.previewSubtitle);
      this.preview.replaceChildren(this.previewImage, this.previewCopy);
      this.container.classList.add('geo-map');
      this.container.classList.toggle('is-selecting-location', this.selectionMode);
      this.container.replaceChildren(
        this.tileLayer,
        this.markerLayer,
        this.selectionLayer,
        this.preview
      );

      this.handlePointerDown = this.handlePointerDown.bind(this);
      this.handlePointerMove = this.handlePointerMove.bind(this);
      this.handlePointerUp = this.handlePointerUp.bind(this);
      this.handleWheel = this.handleWheel.bind(this);
      this.handleDoubleClick = this.handleDoubleClick.bind(this);
      this.container.addEventListener('pointerdown', this.handlePointerDown);
      this.container.addEventListener('pointermove', this.handlePointerMove);
      this.container.addEventListener('pointerup', this.handlePointerUp);
      this.container.addEventListener('pointercancel', this.handlePointerUp);
      this.container.addEventListener('wheel', this.handleWheel, { passive: false });
      this.container.addEventListener('dblclick', this.handleDoubleClick);
      this.resizeObserver = typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => this.scheduleRender())
        : null;
      this.resizeObserver?.observe(this.container);
      this.scheduleRender();
    }

    scheduleRender() {
      if (this.destroyed || this.frame) return;
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.render();
      });
    }

    viewport() {
      return {
        width: Math.max(1, this.container.clientWidth),
        height: Math.max(1, this.container.clientHeight)
      };
    }

    pixelFromClient(clientX, clientY) {
      const bounds = this.container.getBoundingClientRect();
      const viewport = this.viewport();
      return {
        x: (clientX - bounds.left) * viewport.width / Math.max(1, bounds.width),
        y: (clientY - bounds.top) * viewport.height / Math.max(1, bounds.height)
      };
    }

    centerWorld() {
      return project(this.center.latitude, this.center.longitude, this.zoom);
    }

    locationAtPixel(x, y) {
      const viewport = this.viewport();
      const center = this.centerWorld();
      return unproject(
        center.x + x - viewport.width / 2,
        center.y + y - viewport.height / 2,
        this.zoom
      );
    }

    setCenter(location, zoom = this.zoom) {
      const nextCenter = normalizeCoordinates(location);
      if (!nextCenter) return;
      this.center = nextCenter;
      this.zoom = clamp(Math.round(Number(zoom) || this.zoom), MIN_ZOOM, MAX_ZOOM);
      this.scheduleRender();
    }

    getCenter() {
      return { ...this.center, zoom: this.zoom };
    }

    setPoints(points, { fit = false } = {}) {
      this.points = (Array.isArray(points) ? points : []).filter(pointCoordinates);
      for (const marker of this.markerNodes.values()) marker.photoDayStackPhotos = null;
      if (fit) this.fitPoints(this.points);
      else this.scheduleRender();
    }

    setSelection(location) {
      this.selection = normalizeCoordinates(location);
      this.scheduleRender();
    }

    setSelectionMode(enabled) {
      this.selectionMode = Boolean(enabled);
      this.container.classList.toggle('is-selecting-location', this.selectionMode);
      if (this.selectionMode) this.hidePointPreview();
    }

    fitPoints(points = this.points) {
      const locations = points.map(pointCoordinates).filter(Boolean);
      if (!locations.length) {
        this.setCenter({ latitude: 30, longitude: 20 }, 2);
        return;
      }
      if (locations.length === 1) {
        this.setCenter(locations[0], 7);
        return;
      }
      const projected = locations.map((location) => project(location.latitude, location.longitude, 0));
      const xs = projected.map((point) => point.x);
      const ys = projected.map((point) => point.y);
      const bounds = {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys)
      };
      const viewport = this.viewport();
      const availableWidth = Math.max(80, viewport.width - 120);
      const availableHeight = Math.max(80, viewport.height - 120);
      const scale = Math.min(
        availableWidth / Math.max(1, bounds.maxX - bounds.minX),
        availableHeight / Math.max(1, bounds.maxY - bounds.minY)
      );
      const zoom = clamp(Math.floor(Math.log2(scale)), MIN_ZOOM, 12);
      this.setCenter(
        unproject((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2, 0),
        zoom
      );
    }

    zoomBy(amount, anchor = null) {
      const nextZoom = clamp(this.zoom + amount, MIN_ZOOM, MAX_ZOOM);
      if (nextZoom === this.zoom) return;
      const viewport = this.viewport();
      const anchorPoint = anchor || { x: viewport.width / 2, y: viewport.height / 2 };
      const location = this.locationAtPixel(anchorPoint.x, anchorPoint.y);
      this.zoom = nextZoom;
      const locationWorld = project(location.latitude, location.longitude, nextZoom);
      const centerWorld = {
        x: locationWorld.x - anchorPoint.x + viewport.width / 2,
        y: locationWorld.y - anchorPoint.y + viewport.height / 2
      };
      this.center = unproject(centerWorld.x, centerWorld.y, nextZoom);
      this.scheduleRender();
      this.options.onViewChange?.(this.getCenter());
    }

    handlePointerDown(event) {
      if (event.button !== 0 || event.target.closest('.geo-map-marker')) return;
      const center = this.centerWorld();
      const start = this.pixelFromClient(event.clientX, event.clientY);
      this.pointer = {
        id: event.pointerId,
        startX: start.x,
        startY: start.y,
        centerX: center.x,
        centerY: center.y,
        moved: false
      };
      this.container.classList.add('is-panning');
      this.container.setPointerCapture?.(event.pointerId);
    }

    handlePointerMove(event) {
      if (!this.pointer || this.pointer.id !== event.pointerId) return;
      const current = this.pixelFromClient(event.clientX, event.clientY);
      const deltaX = current.x - this.pointer.startX;
      const deltaY = current.y - this.pointer.startY;
      if (Math.hypot(deltaX, deltaY) > 4) this.pointer.moved = true;
      this.center = unproject(
        this.pointer.centerX - deltaX,
        this.pointer.centerY - deltaY,
        this.zoom
      );
      this.scheduleRender();
    }

    handlePointerUp(event) {
      if (!this.pointer || this.pointer.id !== event.pointerId) return;
      const pointer = this.pointer;
      this.pointer = null;
      this.container.classList.remove('is-panning');
      if (this.container.hasPointerCapture?.(event.pointerId)) {
        this.container.releasePointerCapture(event.pointerId);
      }
      if (!pointer.moved) {
        this.center = unproject(pointer.centerX, pointer.centerY, this.zoom);
        this.scheduleRender();
        this.options.onMapClick?.(this.locationAtPixel(pointer.startX, pointer.startY));
      } else {
        this.options.onViewChange?.(this.getCenter());
      }
    }

    handleWheel(event) {
      event.preventDefault();
      const multiplier = event.deltaMode === 1
        ? 18
        : event.deltaMode === 2
          ? this.viewport().height
          : 1;
      const delta = event.deltaY * multiplier;
      const direction = Math.sign(delta);
      if (!direction) return;
      if (direction !== this.wheelDirection) this.wheelAccumulator = 0;
      this.wheelDirection = direction;
      this.wheelAccumulator += delta;
      clearTimeout(this.wheelResetTimer);
      this.wheelResetTimer = setTimeout(() => {
        this.wheelAccumulator = 0;
        this.wheelDirection = 0;
      }, 220);

      const now = typeof performance === 'object' ? performance.now() : Date.now();
      if (
        Math.abs(this.wheelAccumulator) < WHEEL_ZOOM_THRESHOLD
        || now - this.lastWheelZoomAt < WHEEL_ZOOM_COOLDOWN
      ) return;

      this.lastWheelZoomAt = now;
      this.wheelAccumulator = 0;
      this.zoomBy(direction < 0 ? 1 : -1, this.pixelFromClient(event.clientX, event.clientY));
    }

    handleDoubleClick(event) {
      event.preventDefault();
      this.zoomBy(1, this.pixelFromClient(event.clientX, event.clientY));
    }

    renderTiles() {
      const viewport = this.viewport();
      const center = this.centerWorld();
      const tileCount = 2 ** this.zoom;
      const startX = Math.floor((center.x - viewport.width / 2) / TILE_SIZE) - 1;
      const endX = Math.floor((center.x + viewport.width / 2) / TILE_SIZE) + 1;
      const startY = Math.max(0, Math.floor((center.y - viewport.height / 2) / TILE_SIZE) - 1);
      const endY = Math.min(tileCount - 1, Math.floor((center.y + viewport.height / 2) / TILE_SIZE) + 1);
      const visibleKeys = new Set();

      for (let tileY = startY; tileY <= endY; tileY += 1) {
        for (let rawTileX = startX; rawTileX <= endX; rawTileX += 1) {
          const tileX = ((rawTileX % tileCount) + tileCount) % tileCount;
          const key = `${this.zoom}/${rawTileX}/${tileY}`;
          visibleKeys.add(key);
          let image = this.tileNodes.get(key);
          if (!image) {
            image = document.createElement('img');
            image.className = 'geo-map-tile';
            image.alt = '';
            image.draggable = false;
            image.decoding = 'async';
            image.referrerPolicy = 'origin';
            image.src = `https://tile.openstreetmap.org/${this.zoom}/${tileX}/${tileY}.png`;
            image.addEventListener('error', () => image.classList.add('is-unavailable'), { once: true });
            this.tileLayer.append(image);
            this.tileNodes.set(key, image);
          }
          image.style.transform = `translate3d(${rawTileX * TILE_SIZE - center.x + viewport.width / 2}px, ${tileY * TILE_SIZE - center.y + viewport.height / 2}px, 0)`;
        }
      }

      for (const [key, image] of this.tileNodes) {
        if (visibleKeys.has(key)) continue;
        image.remove();
        this.tileNodes.delete(key);
      }
    }

    screenPoint(location) {
      const world = project(location.latitude, location.longitude, this.zoom);
      return this.screenPointFromWorld(world.x, world.y);
    }

    screenPointFromWorld(worldX, worldY) {
      const viewport = this.viewport();
      const center = this.centerWorld();
      const worldSize = TILE_SIZE * (2 ** this.zoom);
      let deltaX = worldX - center.x;
      if (deltaX > worldSize / 2) deltaX -= worldSize;
      if (deltaX < -worldSize / 2) deltaX += worldSize;
      return {
        x: viewport.width / 2 + deltaX,
        y: viewport.height / 2 + worldY - center.y
      };
    }

    markerNode(key) {
      let marker = this.markerNodes.get(key);
      if (marker) return marker;
      marker = document.createElement('div');
      const hit = document.createElement('button');
      hit.type = 'button';
      hit.className = 'geo-map-marker-hit';
      hit.addEventListener('pointerdown', (event) => event.stopPropagation());
      hit.addEventListener('pointerenter', () => this.showPointPreview(marker));
      hit.addEventListener('pointerleave', () => this.hidePointPreview(key));
      hit.addEventListener('focus', () => this.showPointPreview(marker));
      hit.addEventListener('blur', () => this.hidePointPreview(key));
      hit.addEventListener('click', (event) => {
        event.stopPropagation();
        const group = marker.photoDayGroup;
        if (!group) return;
        const uniqueLocations = new Set(group.points.map(mapCoordinateKey));
        if (uniqueLocations.size > 1 && this.zoom < 15) {
          this.setCenter(
            unproject(group.worldX, group.worldY, this.zoom),
            Math.min(15, this.zoom + 2)
          );
          this.options.onViewChange?.(this.getCenter());
          return;
        }
        if (this.selectionMode) {
          if (this.options.onPointClick) this.options.onPointClick(group.points);
          else this.options.onMapClick?.(pointCoordinates(group.points[0]));
          return;
        }
        this.options.onPointClick?.(group.points);
      });
      marker.photoDayHit = hit;
      marker.append(hit);
      this.markerLayer.append(marker);
      this.markerNodes.set(key, marker);
      return marker;
    }

    renderMarkerContent(marker, group, count, stackPhotos) {
      const photoCount = group.points.filter((point) => point.mapPointType === 'photo').length;
      const stackSources = stackPhotos.map((photo) => photo.thumbnailSrc || photo.src);
      const signature = `${count}:${photoCount}:${stackSources.join('|')}`;
      if (marker.photoDayContentSignature === signature) return;

      const hitChildren = [];
      marker.photoDayFan?.remove();
      marker.photoDayFan = null;
      if (stackPhotos.length) {
        const fan = document.createElement('span');
        fan.className = 'geo-map-photo-fan';
        fan.setAttribute('aria-label', 'Фотографии группы');
        stackPhotos.forEach((photo, index) => {
          const fanPhoto = document.createElement('button');
          const image = document.createElement('img');
          const layout = photoFanLayout(stackPhotos.length, index);
          fanPhoto.type = 'button';
          fanPhoto.className = 'geo-map-fan-photo';
          fanPhoto.setAttribute(
            'aria-label',
            photo.date ? `Открыть фотографию за ${photo.date}` : 'Открыть фотографию'
          );
          fanPhoto.style.setProperty('--fan-x', `${layout.x.toFixed(2)}px`);
          fanPhoto.style.setProperty('--fan-y', `${layout.y.toFixed(2)}px`);
          fanPhoto.style.setProperty('--fan-angle', `${layout.angle.toFixed(2)}deg`);
          fanPhoto.style.setProperty('--fan-order', String(index + 1));
          fanPhoto.addEventListener('pointerdown', (event) => event.stopPropagation());
          fanPhoto.addEventListener('click', (event) => {
            event.stopPropagation();
            if (this.options.onPhotoClick) this.options.onPhotoClick(photo);
            else this.options.onPointClick?.([photo]);
          });
          image.src = photo.thumbnailSrc || photo.src;
          image.alt = '';
          image.loading = 'lazy';
          image.decoding = 'async';
          image.draggable = false;
          fanPhoto.append(image);
          fan.append(fanPhoto);
        });
        marker.photoDayFan = fan;
        marker.append(fan);
      }
      if (count > 1) {
        const countLabel = document.createElement('span');
        countLabel.className = 'geo-map-marker-count';
        countLabel.textContent = stackPhotos.length ? String(photoCount) : String(count);
        hitChildren.push(countLabel);
      }
      marker.photoDayHit.replaceChildren(...hitChildren);
      marker.photoDayContentSignature = signature;
    }

    showPointPreview(button) {
      if (!button?.photoDayGroup) return;
      if (button.classList.contains('has-photo-stack')) {
        this.hidePointPreview();
        return;
      }
      const group = button.photoDayGroup;
      const preview = this.options.pointPreview?.(group.points);
      if (!preview) return;
      this.previewKey = group.key;
      this.preview.classList.toggle('has-image', Boolean(preview.src));
      this.previewImage.hidden = !preview.src;
      if (preview.src) this.previewImage.src = preview.src;
      else this.previewImage.removeAttribute('src');
      this.previewImage.alt = preview.alt || '';
      this.previewTitle.textContent = preview.title || '';
      this.previewSubtitle.textContent = preview.subtitle || '';
      this.preview.hidden = false;
      this.positionPointPreview(button.photoDayScreen);
    }

    positionPointPreview(screen) {
      if (this.preview.hidden || !screen) return;
      const viewport = this.viewport();
      const halfWidth = Math.max(82, this.preview.offsetWidth / 2);
      const x = clamp(screen.x, halfWidth + 8, viewport.width - halfWidth - 8);
      const placeBelow = screen.y < this.preview.offsetHeight + 34;
      const y = placeBelow ? screen.y + 24 : screen.y - 20;
      this.preview.classList.toggle('is-below', placeBelow);
      this.preview.style.transform = placeBelow
        ? `translate3d(${x}px, ${y}px, 0) translate(-50%, 0)`
        : `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`;
    }

    hidePointPreview(key = null) {
      if (key && this.previewKey !== key) return;
      this.previewKey = null;
      this.preview.hidden = true;
      this.preview.removeAttribute('style');
    }

    renderMarkers() {
      const viewport = this.viewport();
      const cellSize = markerCellSize(this.zoom);
      const visibleKeys = new Set();
      for (const group of clusterProjectedPoints(this.points, this.zoom, cellSize)) {
        const screen = this.screenPointFromWorld(group.worldX, group.worldY);
        if (
          screen.x < -cellSize
          || screen.y < -cellSize
          || screen.x > viewport.width + cellSize
          || screen.y > viewport.height + cellSize
        ) continue;
        visibleKeys.add(group.key);
        const marker = this.markerNode(group.key);
        const count = group.points.length;
        const referenceOnly = group.points.every((point) => point.mapPointType === 'reference');
        const stackPhotos = marker.photoDayStackPhotos || photoStackPoints(group.points);
        marker.photoDayStackPhotos = stackPhotos;
        marker.className = `geo-map-marker${count > 1 ? ' is-cluster' : ''}${referenceOnly ? ' is-reference' : ''}${stackPhotos.length ? ' has-photo-stack' : ''}`;
        marker.style.transform = `translate3d(${screen.x}px, ${screen.y}px, 0) translate(-50%, -50%)`;
        this.renderMarkerContent(marker, group, count, stackPhotos);
        marker.photoDayHit.setAttribute(
          'aria-label',
          stackPhotos.length
            ? `Фотографий в группе: ${group.points.filter((point) => point.mapPointType === 'photo').length}`
            : count > 1
            ? `${count} точек на карте`
            : referenceOnly
              ? `Открыть место ${group.points[0].name || ''}`.trim()
              : 'Открыть фотографию'
        );
        marker.photoDayGroup = group;
        marker.photoDayScreen = screen;
        if (this.previewKey === group.key) this.positionPointPreview(screen);
      }
      for (const [key, marker] of this.markerNodes) {
        if (visibleKeys.has(key)) continue;
        marker.remove();
        this.markerNodes.delete(key);
        this.hidePointPreview(key);
      }
    }

    renderSelection() {
      if (!this.selection) {
        this.selectionLayer.replaceChildren();
        return;
      }
      const screen = this.screenPoint(this.selection);
      const marker = document.createElement('span');
      marker.className = 'geo-map-selection';
      marker.style.transform = `translate3d(${screen.x}px, ${screen.y}px, 0) translate(-50%, -100%)`;
      marker.setAttribute('aria-hidden', 'true');
      this.selectionLayer.replaceChildren(marker);
    }

    render() {
      this.renderTiles();
      this.renderMarkers();
      this.renderSelection();
      this.container.dataset.zoom = String(this.zoom);
    }

    destroy() {
      this.destroyed = true;
      cancelAnimationFrame(this.frame);
      clearTimeout(this.wheelResetTimer);
      this.resizeObserver?.disconnect();
      this.container.removeEventListener('pointerdown', this.handlePointerDown);
      this.container.removeEventListener('pointermove', this.handlePointerMove);
      this.container.removeEventListener('pointerup', this.handlePointerUp);
      this.container.removeEventListener('pointercancel', this.handlePointerUp);
      this.container.removeEventListener('wheel', this.handleWheel);
      this.container.removeEventListener('dblclick', this.handleDoubleClick);
    }
  }

  return {
    InteractiveMap,
    MAX_LATITUDE,
    MAX_ZOOM,
    MIN_ZOOM,
    clusterProjectedPoints,
    distinctMapPointCount,
    linkedReferencePlaces,
    mapCoordinateKey,
    normalizeCoordinates,
    normalizeLongitude,
    parseCoordinateQuery,
    photoFanLayout,
    photoStackPoints,
    project,
    referencePlaceSuggestions,
    unproject,
    visibleReferencePoints
  };
}));
