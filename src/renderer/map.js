(function exposePhotoDayMap(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PhotoDayMap = api;
}(typeof globalThis === 'object' ? globalThis : this, () => {
  const TILE_SIZE = 256;
  const MAX_LATITUDE = 85.05112878;
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 18;

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

  class InteractiveMap {
    constructor(container, options = {}) {
      if (!container) throw new Error('Не указан контейнер карты');
      this.container = container;
      this.options = options;
      this.center = normalizeCoordinates(options.center) || { latitude: 30, longitude: 20 };
      this.zoom = clamp(Math.round(Number(options.zoom) || 2), MIN_ZOOM, MAX_ZOOM);
      this.points = [];
      this.selection = null;
      this.tileNodes = new Map();
      this.frame = 0;
      this.pointer = null;
      this.destroyed = false;

      this.tileLayer = document.createElement('div');
      this.tileLayer.className = 'geo-map-tiles';
      this.markerLayer = document.createElement('div');
      this.markerLayer.className = 'geo-map-markers';
      this.selectionLayer = document.createElement('div');
      this.selectionLayer.className = 'geo-map-selection-layer';
      this.container.classList.add('geo-map');
      this.container.replaceChildren(this.tileLayer, this.markerLayer, this.selectionLayer);

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
      if (fit) this.fitPoints(this.points);
      else this.scheduleRender();
    }

    setSelection(location) {
      this.selection = normalizeCoordinates(location);
      this.scheduleRender();
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
      this.pointer = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        centerX: center.x,
        centerY: center.y,
        moved: false
      };
      this.container.classList.add('is-panning');
      this.container.setPointerCapture?.(event.pointerId);
    }

    handlePointerMove(event) {
      if (!this.pointer || this.pointer.id !== event.pointerId) return;
      const deltaX = event.clientX - this.pointer.startX;
      const deltaY = event.clientY - this.pointer.startY;
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
        const bounds = this.container.getBoundingClientRect();
        this.options.onMapClick?.(
          this.locationAtPixel(event.clientX - bounds.left, event.clientY - bounds.top)
        );
      } else {
        this.options.onViewChange?.(this.getCenter());
      }
    }

    handleWheel(event) {
      event.preventDefault();
      const bounds = this.container.getBoundingClientRect();
      this.zoomBy(event.deltaY < 0 ? 1 : -1, {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top
      });
    }

    handleDoubleClick(event) {
      event.preventDefault();
      const bounds = this.container.getBoundingClientRect();
      this.zoomBy(1, {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top
      });
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
          image.style.transform = `translate3d(${Math.round(rawTileX * TILE_SIZE - center.x + viewport.width / 2)}px, ${Math.round(tileY * TILE_SIZE - center.y + viewport.height / 2)}px, 0)`;
        }
      }

      for (const [key, image] of this.tileNodes) {
        if (visibleKeys.has(key)) continue;
        image.remove();
        this.tileNodes.delete(key);
      }
    }

    screenPoint(location) {
      const viewport = this.viewport();
      const center = this.centerWorld();
      const world = project(location.latitude, location.longitude, this.zoom);
      const worldSize = TILE_SIZE * (2 ** this.zoom);
      let deltaX = world.x - center.x;
      if (deltaX > worldSize / 2) deltaX -= worldSize;
      if (deltaX < -worldSize / 2) deltaX += worldSize;
      return {
        x: viewport.width / 2 + deltaX,
        y: viewport.height / 2 + world.y - center.y
      };
    }

    renderMarkers() {
      const viewport = this.viewport();
      const cellSize = this.zoom >= 13 ? 42 : this.zoom >= 7 ? 48 : 56;
      const groups = new Map();
      for (const point of this.points) {
        const location = pointCoordinates(point);
        const screen = this.screenPoint(location);
        if (
          screen.x < -cellSize
          || screen.y < -cellSize
          || screen.x > viewport.width + cellSize
          || screen.y > viewport.height + cellSize
        ) continue;
        const key = `${Math.floor(screen.x / cellSize)}:${Math.floor(screen.y / cellSize)}`;
        const group = groups.get(key) || { points: [], x: 0, y: 0 };
        group.points.push(point);
        group.x += screen.x;
        group.y += screen.y;
        groups.set(key, group);
      }

      const markers = [];
      for (const group of groups.values()) {
        const button = document.createElement('button');
        const count = group.points.length;
        const x = group.x / count;
        const y = group.y / count;
        button.type = 'button';
        button.className = `geo-map-marker${count > 1 ? ' is-cluster' : ''}`;
        button.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(-50%, -50%)`;
        button.textContent = count > 1 ? String(count) : '';
        button.title = count > 1 ? `${count} фотографий` : 'Открыть фотографию';
        button.setAttribute('aria-label', button.title);
        button.addEventListener('pointerdown', (event) => event.stopPropagation());
        button.addEventListener('click', (event) => {
          event.stopPropagation();
          const uniqueLocations = new Set(group.points.map((point) => (
            `${Number(point.latitude).toFixed(5)}:${Number(point.longitude).toFixed(5)}`
          )));
          if (uniqueLocations.size > 1 && this.zoom < 15) {
            this.setCenter(this.locationAtPixel(x, y), Math.min(15, this.zoom + 2));
            this.options.onViewChange?.(this.getCenter());
            return;
          }
          this.options.onPointClick?.(group.points);
        });
        markers.push(button);
      }
      this.markerLayer.replaceChildren(...markers);
    }

    renderSelection() {
      if (!this.selection) {
        this.selectionLayer.replaceChildren();
        return;
      }
      const screen = this.screenPoint(this.selection);
      const marker = document.createElement('span');
      marker.className = 'geo-map-selection';
      marker.style.transform = `translate3d(${Math.round(screen.x)}px, ${Math.round(screen.y)}px, 0) translate(-50%, -100%)`;
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
    normalizeCoordinates,
    normalizeLongitude,
    project,
    unproject
  };
}));
