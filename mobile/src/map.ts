import type {
  ArchiveLocation,
  ArchiveViewerMetadata
} from '../modules/photo-archive';
import type { IndexedPhoto } from './calendar';

export type LocatedArchivePhoto = IndexedPhoto & {
  location: ArchiveLocation;
};

export type ArchiveMapGroup = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  photos: LocatedArchivePhoto[];
};

export type MiniMapTile = {
  key: string;
  left: number;
  top: number;
  url: string;
};

export type ArchiveMapPalette = {
  accent: string;
  emptyCell: string;
  mapTileFilter: string;
  muted: string;
  onAccent: string;
};

export type ArchiveMapCluster = {
  groups: ArchiveMapGroup[];
  key: string;
  latitude: number;
  longitude: number;
  photoCount: number;
};

const MAP_TILE_SIZE = 256;
const MAX_MERCATOR_LATITUDE = 85.05112878;
const MAX_OVERVIEW_MAP_ZOOM = 19;

export function buildMiniMapTiles(
  location: Pick<ArchiveLocation, 'latitude' | 'longitude'>,
  viewportWidth: number,
  viewportHeight: number,
  zoom = 12
): MiniMapTile[] {
  if (!validCoordinates(location as ArchiveLocation)) return [];
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0
    || !Number.isFinite(viewportHeight) || viewportHeight <= 0) return [];
  if (!Number.isInteger(zoom) || zoom < 0 || zoom > 19) {
    throw new RangeError('Масштаб мини-карты должен быть от 0 до 19');
  }
  const tileCount = 2 ** zoom;
  const worldSize = MAP_TILE_SIZE * tileCount;
  const latitude = Math.max(
    -MAX_MERCATOR_LATITUDE,
    Math.min(MAX_MERCATOR_LATITUDE, location.latitude)
  );
  const latitudeRadians = latitude * Math.PI / 180;
  const centerX = (location.longitude + 180) / 360 * worldSize;
  const centerY = (
    0.5
    - Math.log((1 + Math.sin(latitudeRadians)) / (1 - Math.sin(latitudeRadians)))
      / (4 * Math.PI)
  ) * worldSize;
  const viewportLeft = centerX - viewportWidth / 2;
  const viewportTop = centerY - viewportHeight / 2;
  const firstTileX = Math.floor(viewportLeft / MAP_TILE_SIZE);
  const lastTileX = Math.floor((viewportLeft + viewportWidth) / MAP_TILE_SIZE);
  const firstTileY = Math.floor(viewportTop / MAP_TILE_SIZE);
  const lastTileY = Math.floor((viewportTop + viewportHeight) / MAP_TILE_SIZE);
  const tiles: MiniMapTile[] = [];
  for (let tileY = firstTileY; tileY <= lastTileY; tileY += 1) {
    if (tileY < 0 || tileY >= tileCount) continue;
    for (let tileX = firstTileX; tileX <= lastTileX; tileX += 1) {
      const wrappedX = ((tileX % tileCount) + tileCount) % tileCount;
      tiles.push({
        key: `${zoom}:${tileX}:${tileY}`,
        left: tileX * MAP_TILE_SIZE - viewportLeft,
        top: tileY * MAP_TILE_SIZE - viewportTop,
        url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${tileY}.png`
      });
    }
  }
  return tiles;
}

export function buildArchiveMapGroups(
  photos: IndexedPhoto[],
  locations: ArchiveViewerMetadata['locations'],
  precision = 5
): ArchiveMapGroup[] {
  if (!Number.isInteger(precision) || precision < 0 || precision > 8) {
    throw new RangeError('Точность группировки карты должна быть от 0 до 8');
  }
  const groups = new Map<string, {
    locations: ArchiveLocation[];
    photos: LocatedArchivePhoto[];
  }>();
  for (const photo of photos) {
    const location = locations[photo.relativePath];
    if (!validCoordinates(location)) continue;
    const id = `${coordinateKey(location.latitude, precision)}:${coordinateKey(location.longitude, precision)}`;
    const group = groups.get(id) || { locations: [], photos: [] };
    group.locations.push(location);
    group.photos.push({ ...photo, location });
    groups.set(id, group);
  }
  return [...groups.entries()].map(([id, group]) => {
    const latitude = average(group.locations.map((location) => location.latitude));
    const longitude = average(group.locations.map((location) => location.longitude));
    const namedLocation = group.locations.find((location) => location.place?.trim())
      || group.locations.find((location) => location.country?.trim());
    return {
      id,
      label: namedLocation?.place?.trim()
        || namedLocation?.country?.trim()
        || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      latitude,
      longitude,
      photos: group.photos
    };
  });
}

export function clusterArchiveMapGroups(
  groups: ArchiveMapGroup[],
  zoom: number,
  cellSize = archiveMapMarkerCellSize(zoom)
): ArchiveMapCluster[] {
  if (!Number.isInteger(zoom) || zoom < 0 || zoom > MAX_OVERVIEW_MAP_ZOOM) {
    throw new RangeError('Масштаб карты должен быть от 0 до 19');
  }
  if (!Number.isFinite(cellSize) || cellSize <= 0) {
    throw new RangeError('Размер ячейки кластеризации должен быть положительным');
  }
  const clusters = new Map<string, {
    groups: ArchiveMapGroup[];
    photoCount: number;
    worldX: number;
    worldY: number;
  }>();
  for (const group of groups) {
    if (!validCoordinates(group)) continue;
    const world = projectMapCoordinates(group.latitude, group.longitude, zoom);
    const key = `${zoom}:${Math.floor(world.x / cellSize)}:${Math.floor(world.y / cellSize)}`;
    const cluster = clusters.get(key) || {
      groups: [],
      photoCount: 0,
      worldX: 0,
      worldY: 0
    };
    cluster.groups.push(group);
    cluster.photoCount += group.photos.length;
    cluster.worldX += world.x;
    cluster.worldY += world.y;
    clusters.set(key, cluster);
  }
  return [...clusters.entries()].map(([key, cluster]) => {
    const location = unprojectMapCoordinates(
      cluster.worldX / cluster.groups.length,
      cluster.worldY / cluster.groups.length,
      zoom
    );
    return {
      groups: cluster.groups,
      key,
      latitude: location.latitude,
      longitude: location.longitude,
      photoCount: cluster.photoCount
    };
  });
}

export function buildPhotoLocationMapHtml(
  location: ArchiveLocation | null | undefined,
  editable: boolean,
  palette: ArchiveMapPalette
): string {
  const normalizedLocation = validCoordinates(location || undefined) ? location : null;
  const latitude = Number(normalizedLocation?.latitude ?? 55.751244);
  const longitude = Number(normalizedLocation?.longitude ?? 37.618423);
  const zoom = normalizedLocation ? 13 : 2;
  return `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
html,body,#map{width:100%;height:100%;margin:0;background:${palette.emptyCell}}
.leaflet-pane,.leaflet-tile,.leaflet-marker-icon,.leaflet-marker-shadow,.leaflet-tile-container,.leaflet-pane>svg,.leaflet-pane>canvas,.leaflet-zoom-box,.leaflet-image-layer,.leaflet-layer{position:absolute;left:0;top:0}
.leaflet-container{overflow:hidden;-webkit-tap-highlight-color:transparent}
.leaflet-tile,.leaflet-marker-icon,.leaflet-marker-shadow{-webkit-user-select:none;user-select:none;-webkit-user-drag:none}
.leaflet-marker-icon,.leaflet-marker-shadow{display:block}
.leaflet-container .leaflet-overlay-pane svg,.leaflet-container .leaflet-marker-pane img,.leaflet-container .leaflet-shadow-pane img,.leaflet-container .leaflet-tile-pane img,.leaflet-container img.leaflet-image-layer,.leaflet-container .leaflet-tile{max-width:none!important;max-height:none!important}
.leaflet-container.leaflet-touch-zoom{touch-action:pan-x pan-y}.leaflet-container.leaflet-touch-drag{touch-action:none;touch-action:pinch-zoom}.leaflet-container.leaflet-touch-drag.leaflet-touch-zoom{touch-action:none}
.leaflet-tile{filter:inherit;visibility:hidden}.leaflet-tile-loaded{visibility:inherit}
.leaflet-zoom-animated{transform-origin:0 0;will-change:transform}.leaflet-zoom-anim .leaflet-zoom-animated{transition:transform .25s cubic-bezier(0,0,.25,1)}.leaflet-zoom-anim .leaflet-tile,.leaflet-pan-anim .leaflet-tile{transition:none}.leaflet-zoom-anim .leaflet-zoom-hide{visibility:hidden}
.leaflet-pane{z-index:400}.leaflet-tile-pane{z-index:200;filter:${palette.mapTileFilter}}.leaflet-overlay-pane{z-index:400}.leaflet-shadow-pane{z-index:500}.leaflet-marker-pane{z-index:600}.leaflet-tooltip-pane{z-index:650}.leaflet-popup-pane{z-index:700}
.leaflet-control{position:relative;z-index:800;pointer-events:auto}.leaflet-top,.leaflet-bottom{position:absolute;z-index:1000;pointer-events:none}.leaflet-top{top:0}.leaflet-right{right:0}.leaflet-bottom{bottom:0}.leaflet-left{left:0}.leaflet-control{float:left;clear:both}.leaflet-right .leaflet-control{float:right}.leaflet-top .leaflet-control{margin-top:10px}.leaflet-bottom .leaflet-control{margin-bottom:10px}.leaflet-left .leaflet-control{margin-left:10px}.leaflet-right .leaflet-control{margin-right:10px}
.leaflet-bar{border:2px solid rgba(0,0,0,.2);border-radius:4px;background-clip:padding-box}.leaflet-bar a{display:block;width:30px;height:30px;border-bottom:1px solid #ccc;background:#fff;color:#222;font:700 20px/30px Arial,sans-serif;text-align:center;text-decoration:none}.leaflet-bar a:first-child{border-radius:2px 2px 0 0}.leaflet-bar a:last-child{border-bottom:0;border-radius:0 0 2px 2px}.leaflet-bar a.leaflet-disabled{background:#f4f4f4;color:#bbb}
.leaflet-control-attribution{padding:1px 5px;background:rgba(255,255,255,.8);color:#333;font:8px/1.4 -apple-system,sans-serif}.leaflet-control-attribution a{color:#1769aa;text-decoration:none}
.photo-location-marker-wrap{background:transparent;border:0}.photo-location-marker{background:${palette.accent};border:3px solid #fffdf7;border-radius:50% 50% 50% 0;box-shadow:0 4px 12px rgba(13,38,31,.42);box-sizing:border-box;height:24px;transform:rotate(-45deg);width:24px}.photo-location-marker:after{background:#fffdf7;border-radius:50%;content:'';height:7px;left:5.5px;position:absolute;top:5.5px;width:7px}
</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
 integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin="anonymous"></script>
<script>
const map=L.map('map',{attributionControl:true,bounceAtZoomLimits:false,worldCopyJump:true,zoomControl:true}).setView([${latitude},${longitude}],${zoom});
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',keepBuffer:3,maxZoom:19,updateWhenIdle:true}).addTo(map);
const locationIcon=L.divIcon({className:'photo-location-marker-wrap',html:'<div class="photo-location-marker"></div>',iconAnchor:[12,24],iconSize:[24,24]});
let marker=${normalizedLocation ? `L.marker([${latitude},${longitude}],{icon:locationIcon}).addTo(map)` : 'null'};
${editable ? `map.on('click',function(event){
  if(marker)marker.setLatLng(event.latlng);else marker=L.marker(event.latlng,{icon:locationIcon}).addTo(map);
  window.ReactNativeWebView.postMessage(JSON.stringify({latitude:event.latlng.lat,longitude:event.latlng.lng}));
});` : ''}
function syncMapSize(){map.invalidateSize({animate:false,pan:false})}
if(window.ResizeObserver)new ResizeObserver(syncMapSize).observe(document.getElementById('map'));
window.addEventListener('resize',syncMapSize);
requestAnimationFrame(syncMapSize);
</script></body></html>`;
}

export function buildArchiveOverviewMapHtml(
  groups: ArchiveMapGroup[],
  palette: ArchiveMapPalette
): string {
  const points = groups.map((group) => ({
    id: group.id,
    latitude: group.latitude,
    longitude: group.longitude,
    photoCount: group.photos.length
  }));
  const serializedPoints = JSON.stringify(points).replace(/</g, '\\u003c');
  return `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
html,body,#map{width:100%;height:100%;margin:0;background:${palette.emptyCell}}
.leaflet-pane,.leaflet-tile,.leaflet-marker-icon,.leaflet-marker-shadow,.leaflet-tile-container,.leaflet-pane>svg,.leaflet-pane>canvas,.leaflet-zoom-box,.leaflet-image-layer,.leaflet-layer{position:absolute;left:0;top:0}
.leaflet-container{overflow:hidden;-webkit-tap-highlight-color:transparent}
.leaflet-tile,.leaflet-marker-icon,.leaflet-marker-shadow{-webkit-user-select:none;user-select:none;-webkit-user-drag:none}
.leaflet-marker-icon,.leaflet-marker-shadow{display:block}
.leaflet-container .leaflet-overlay-pane svg,.leaflet-container .leaflet-marker-pane img,.leaflet-container .leaflet-shadow-pane img,.leaflet-container .leaflet-tile-pane img,.leaflet-container img.leaflet-image-layer,.leaflet-container .leaflet-tile{max-width:none!important;max-height:none!important}
.leaflet-container.leaflet-touch-zoom{touch-action:pan-x pan-y}
.leaflet-container.leaflet-touch-drag{touch-action:none;touch-action:pinch-zoom}
.leaflet-container.leaflet-touch-drag.leaflet-touch-zoom{touch-action:none}
.leaflet-tile{filter:inherit;visibility:hidden}.leaflet-tile-loaded{visibility:inherit}
.leaflet-zoom-animated{transform-origin:0 0}.leaflet-zoom-animated{will-change:transform}.leaflet-zoom-anim .leaflet-zoom-animated{transition:transform .25s cubic-bezier(0,0,.25,1)}.leaflet-zoom-anim .leaflet-tile,.leaflet-pan-anim .leaflet-tile{transition:none}.leaflet-zoom-anim .leaflet-zoom-hide{visibility:hidden}
.leaflet-pane{z-index:400}.leaflet-tile-pane{z-index:200}.leaflet-overlay-pane{z-index:400}.leaflet-shadow-pane{z-index:500}.leaflet-marker-pane{z-index:600}.leaflet-tooltip-pane{z-index:650}.leaflet-popup-pane{z-index:700}
.leaflet-map-pane canvas{z-index:100}.leaflet-map-pane svg{z-index:200}
.leaflet-control{position:relative;z-index:800;pointer-events:auto}.leaflet-top,.leaflet-bottom{position:absolute;z-index:1000;pointer-events:none}.leaflet-top{top:0}.leaflet-right{right:0}.leaflet-bottom{bottom:0}.leaflet-left{left:0}.leaflet-control{float:left;clear:both}.leaflet-right .leaflet-control{float:right}.leaflet-top .leaflet-control{margin-top:10px}.leaflet-bottom .leaflet-control{margin-bottom:10px}.leaflet-left .leaflet-control{margin-left:10px}.leaflet-right .leaflet-control{margin-right:10px}
.leaflet-bar{border:2px solid rgba(0,0,0,.2);border-radius:4px;background-clip:padding-box}.leaflet-bar a{display:block;width:30px;height:30px;border-bottom:1px solid #ccc;background:#fff;color:#222;font:700 20px/30px Arial,sans-serif;text-align:center;text-decoration:none}.leaflet-bar a:first-child{border-radius:2px 2px 0 0}.leaflet-bar a:last-child{border-bottom:0;border-radius:0 0 2px 2px}.leaflet-bar a.leaflet-disabled{background:#f4f4f4;color:#bbb}
.leaflet-control-attribution{padding:1px 5px;background:rgba(255,255,255,.8);color:#333;font:8px/1.4 -apple-system,sans-serif}.leaflet-control-attribution a{color:#1769aa;text-decoration:none}
#fallback{box-sizing:border-box;color:${palette.muted};font:600 13px -apple-system,sans-serif;padding:24px;text-align:center}
.leaflet-tile-pane{filter:${palette.mapTileFilter}}
.photo-marker-wrap{background:transparent;border:0}
.photo-marker{align-items:center;background:${palette.accent};border:3px solid #fffdf7;border-radius:50%;box-shadow:0 5px 14px rgba(13,38,31,.3);box-sizing:border-box;color:${palette.onAccent};display:flex;font:800 12px -apple-system,sans-serif;height:34px;justify-content:center;min-width:34px;padding:0 7px;transform:translate(-4px,-4px)}
.photo-marker.active{background:#214f40;box-shadow:0 0 0 5px #efb84c,0 7px 20px rgba(13,38,31,.48)}
</style></head><body><div id="map"><div id="fallback">Загружаем карту… Для подложки нужен интернет.</div></div>
<script>
const points=${serializedPoints};
let mapStarted=false;
function startMap(){
  if(mapStarted||!window.L)return;
  mapStarted=true;
  const fallback=document.getElementById('fallback');if(fallback)fallback.remove();
  const map=L.map('map',{attributionControl:true,bounceAtZoomLimits:false,worldCopyJump:true,zoomAnimation:true,zoomControl:true});
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',keepBuffer:4,maxZoom:19,updateWhenIdle:true}).addTo(map);
  const markerNodes=new Map();
  let markerFrame=0;
  function markerCellSize(zoom){return zoom>=13?42:zoom>=7?48:56}
  function clusterProjectedPoints(zoom,cellSize){
    const clusters=new Map();
    points.forEach(function(point){
      const world=map.project([point.latitude,point.longitude],zoom);
      const key=zoom+':'+Math.floor(world.x/cellSize)+':'+Math.floor(world.y/cellSize);
      const cluster=clusters.get(key)||{key:key,points:[],photoCount:0,worldX:0,worldY:0};
      cluster.points.push(point);
      cluster.photoCount+=point.photoCount;
      cluster.worldX+=world.x;
      cluster.worldY+=world.y;
      clusters.set(key,cluster);
    });
    return Array.from(clusters.values()).map(function(cluster){
      cluster.worldX/=cluster.points.length;
      cluster.worldY/=cluster.points.length;
      return cluster;
    });
  }
  function markerIcon(cluster){
    const count=cluster.photoCount>99?'99+':String(cluster.photoCount);
    const className='photo-marker'+(cluster.points.length>1?' is-cluster':'');
    return L.divIcon({className:'photo-marker-wrap',html:'<div class="'+className+'">'+count+'</div>',iconSize:[34,34],iconAnchor:[17,17]});
  }
  function clearActiveMarkers(){
    markerNodes.forEach(function(marker){
      const node=marker.getElement();
      const bubble=node&&node.querySelector('.photo-marker');
      if(bubble)bubble.classList.remove('active');
    });
  }
  function selectMarker(marker){
    const cluster=marker.photoDayCluster;
    if(!cluster)return;
    const ids=cluster.points.map(function(point){return point.id});
    if(ids.length>1&&map.getZoom()<15){
      map.setView(marker.getLatLng(),Math.min(15,map.getZoom()+2),{animate:true});
      return;
    }
    clearActiveMarkers();
    const node=marker.getElement();
    const bubble=node&&node.querySelector('.photo-marker');
    if(bubble)bubble.classList.add('active');
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'groups',ids:ids}));
  }
  function renderMarkers(){
    markerFrame=0;
    const zoom=map.getZoom();
    const cellSize=markerCellSize(zoom);
    const viewport=map.getSize();
    const visibleKeys=new Set();
    clusterProjectedPoints(zoom,cellSize).forEach(function(cluster){
      const latLng=map.unproject(L.point(cluster.worldX,cluster.worldY),zoom);
      const screen=map.latLngToContainerPoint(latLng);
      if(screen.x< -cellSize||screen.y< -cellSize||screen.x>viewport.x+cellSize||screen.y>viewport.y+cellSize)return;
      visibleKeys.add(cluster.key);
      let marker=markerNodes.get(cluster.key);
      if(!marker){
        marker=L.marker(latLng,{icon:markerIcon(cluster),keyboard:true,title:cluster.photoCount+' фото · '+cluster.points.length+' мест'});
        marker.on('click',function(){selectMarker(marker)});
        marker.addTo(map);
        markerNodes.set(cluster.key,marker);
      }else{
        marker.setLatLng(latLng);
      }
      marker.photoDayCluster=cluster;
    });
    markerNodes.forEach(function(marker,key){
      if(!visibleKeys.has(key)){marker.remove();markerNodes.delete(key)}
    });
  }
  function scheduleMarkerRender(){
    if(markerFrame)return;
    markerFrame=requestAnimationFrame(renderMarkers);
  }
  if(points.length===1)map.setView([points[0].latitude,points[0].longitude],13);
  else if(points.length>1)map.fitBounds(L.latLngBounds(points.map(function(point){return [point.latitude,point.longitude]})).pad(0.16),{maxZoom:14});
  map.on('moveend zoomend',scheduleMarkerRender);
  map.on('resize',scheduleMarkerRender);
  scheduleMarkerRender();
  function syncMapSize(){map.invalidateSize({animate:false,pan:false})}
  window.__photoDayMapInvalidate=syncMapSize;
  if(window.ResizeObserver)new ResizeObserver(syncMapSize).observe(document.getElementById('map'));
  window.addEventListener('resize',syncMapSize);
  requestAnimationFrame(syncMapSize);
  setTimeout(syncMapSize,100);
  setTimeout(syncMapSize,500);
}
function loadMapFallback(){
  const script=document.createElement('script');
  script.src='https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
  script.onload=startMap;
  document.head.appendChild(script);
}
</script>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
 integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin="anonymous" onload="startMap()" onerror="loadMapFallback()"></script>
</body></html>`;
}

function validCoordinates(location?: ArchiveLocation): location is ArchiveLocation {
  return Boolean(
    location
    && Number.isFinite(location.latitude)
    && Number.isFinite(location.longitude)
    && location.latitude >= -90
    && location.latitude <= 90
    && location.longitude >= -180
    && location.longitude <= 180
  );
}

function coordinateKey(value: number, precision: number): string {
  const rounded = Number(value.toFixed(precision));
  return (Object.is(rounded, -0) ? 0 : rounded).toFixed(precision);
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function archiveMapMarkerCellSize(zoom: number): number {
  return zoom >= 13 ? 42 : zoom >= 7 ? 48 : 56;
}

function projectMapCoordinates(latitude: number, longitude: number, zoom: number) {
  const worldSize = MAP_TILE_SIZE * (2 ** zoom);
  const safeLatitude = Math.max(
    -MAX_MERCATOR_LATITUDE,
    Math.min(MAX_MERCATOR_LATITUDE, latitude)
  );
  const sine = Math.sin(safeLatitude * Math.PI / 180);
  return {
    x: (longitude + 180) / 360 * worldSize,
    y: (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * worldSize
  };
}

function unprojectMapCoordinates(x: number, y: number, zoom: number) {
  const worldSize = MAP_TILE_SIZE * (2 ** zoom);
  const mercator = Math.PI - 2 * Math.PI * y / worldSize;
  return {
    latitude: 180 / Math.PI * Math.atan(Math.sinh(mercator)),
    longitude: x / worldSize * 360 - 180
  };
}
