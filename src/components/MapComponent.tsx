import React, { useEffect, useRef, useState } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';
import { Location, TYPE_COLORS } from '../constants';
import { cn } from '../lib/utils';

interface MapProps {
  locations: Location[];
  selectedLocationId?: string;
  onMarkerClick?: (location: Location) => void;
  onHoverType?: (type: Location['type'] | null) => void;
  hoveredType?: Location['type'] | null;
}

const getMarkerContent = (loc: Location, state: 'normal' | 'hovered' | 'selected') => {
  let size = 12;
  let border = 2;
  let extraStyle = '';

  if (state === 'selected') {
    size = 20;
    border = 3;
    extraStyle = `box-shadow: 0 0 10px ${TYPE_COLORS[loc.type]};`;
  } else if (state === 'hovered') {
    size = 18;
    border = 2;
    extraStyle = `box-shadow: 0 0 15px ${TYPE_COLORS[loc.type]}; transform: scale(1.1); transition: all 0.3s ease;`;
  } else {
    extraStyle = `box-shadow: 0 2px 4px rgba(0,0,0,0.3); transition: all 0.3s ease;`;
  }

  const textStyle = state === 'selected'
    ? `position: absolute; top: ${size / 2 + 10}px; white-space: nowrap; color: #0f172a; font-size: 14px; font-weight: 800; text-shadow: 2px 2px 0 rgba(255,255,255,0.9), -2px -2px 0 rgba(255,255,255,0.9), 2px -2px 0 rgba(255,255,255,0.9), -2px 2px 0 rgba(255,255,255,0.9), 0 2px 0 rgba(255,255,255,0.9), 2px 0 0 rgba(255,255,255,0.9), 0 -2px 0 rgba(255,255,255,0.9), -2px 0 0 rgba(255,255,255,0.9); z-index: 10; transition: all 0.3s ease; transform: translateX(-50%); left: 50%;`
    : `position: absolute; top: ${size / 2 + 8}px; white-space: nowrap; color: #1e293b; font-size: 12px; font-weight: 700; text-shadow: 1px 1px 0 rgba(255,255,255,0.9), -1px -1px 0 rgba(255,255,255,0.9), 1px -1px 0 rgba(255,255,255,0.9), -1px 1px 0 rgba(255,255,255,0.9), 0 1px 0 rgba(255,255,255,0.9), 1px 0 0 rgba(255,255,255,0.9), 0 -1px 0 rgba(255,255,255,0.9), -1px 0 0 rgba(255,255,255,0.9); z-index: 10; transition: all 0.3s ease; transform: translateX(-50%); left: 50%; opacity: ${state === 'hovered' ? 1 : 0.85};`;

  return `
    <div style="position: relative; display: flex; align-items: center; justify-content: center; width: ${size}px; height: ${size}px;">
      <div style="background-color: ${TYPE_COLORS[loc.type]}; width: ${size}px; height: ${size}px; border-radius: 50%; border: ${border}px solid white; ${extraStyle}"></div>
      <div style="${textStyle}">
        ${loc.name}
      </div>
    </div>
  `;
};

const MapComponent: React.FC<MapProps> = ({
  locations,
  selectedLocationId,
  onMarkerClick,
  onHoverType,
  hoveredType
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const amapInstance = useRef<any>(null);
  const amapConstructor = useRef<any>(null);
  const markersRef = useRef<{ [key: string]: any }>({});
  const [isMapReady, setIsMapReady] = useState(false);

  useEffect(() => {
    if (!mapRef.current) return;

    // Use ResizeObserver to ensure container has size before initializing map
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry.contentRect.width > 0 && entry.contentRect.height > 0 && !amapInstance.current) {
        initMap();
        observer.disconnect();
      }
    });

    observer.observe(mapRef.current);

    const initMap = () => {
      (window as any)._AMapSecurityConfig = {
        securityJsCode: import.meta.env.VITE_AMAP_SECURITY_CODE,
      };

      AMapLoader.load({
        key: import.meta.env.VITE_AMAP_KEY,
        version: '2.0',
        plugins: ['AMap.Scale', 'AMap.ToolBar'],
      }).then((AMap) => {
        if (!mapRef.current) return;

        amapConstructor.current = AMap;

        const map = new AMap.Map(mapRef.current, {
          zoom: 11,
          center: [121.4737, 31.2304],
          viewMode: '3D',
          pitchEnable: true,
          rotationEnable: true,
        });

        // Add controls only after map is initialized
        map.on('complete', () => {
          map.addControl(new AMap.Scale());
          map.addControl(new AMap.ToolBar());
        });

        amapInstance.current = map;

        // Add markers
        locations.forEach((loc) => {
          const marker = new AMap.Marker({
            position: new AMap.LngLat(loc.coordinates[0], loc.coordinates[1]),
            title: loc.name,
            content: getMarkerContent(loc, 'normal'),
            anchor: 'center',
          });

          marker.on('click', () => {
            if (onMarkerClick) onMarkerClick(loc);
          });

          marker.setMap(map);
          markersRef.current[loc.id] = marker;
        });

        map.setFitView();
        setIsMapReady(true);
      }).catch(e => {
        console.error('AMap Loader Error:', e);
      });
    };

    return () => {
      observer.disconnect();
      if (amapInstance.current) {
        amapInstance.current.destroy();
      }
    };
  }, []);

  // Update selection and hover state
  useEffect(() => {
    if (!amapInstance.current || !isMapReady || !amapConstructor.current) return;

    const AMap = amapConstructor.current;

    Object.entries(markersRef.current).forEach(([id, marker]: [string, any]) => {
      const loc = locations.find(l => l.id === id);
      if (!loc) return;

      const isSelected = id === selectedLocationId;
      const isHoveredType = loc.type === hoveredType;

      if (isSelected) {
        marker.setContent(getMarkerContent(loc, 'selected'));
        marker.setzIndex(100);
        amapInstance.current.setCenter(new AMap.LngLat(loc.coordinates[0], loc.coordinates[1]));
      } else if (isHoveredType) {
        marker.setContent(getMarkerContent(loc, 'hovered'));
        marker.setzIndex(90);
      } else {
        marker.setContent(getMarkerContent(loc, 'normal'));
        marker.setzIndex(10);
      }
    });
  }, [selectedLocationId, hoveredType, locations, isMapReady]);

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden shadow-inner bg-slate-100 relative touch-none">
      <div ref={mapRef} className="w-full h-full" />
      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur p-3 rounded-xl shadow-lg border border-slate-200 text-xs space-y-2 z-10">
        <div className="font-bold mb-1">图例</div>
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div
            key={type}
            className={cn(
              "flex items-center gap-2 cursor-pointer transition-all p-1 rounded-md",
              hoveredType === type ? "bg-slate-100 scale-105" : "hover:bg-slate-50"
            )}
            onMouseEnter={() => onHoverType?.(type as Location['type'])}
            onMouseLeave={() => onHoverType?.(null)}
          >
            <div
              className="w-3 h-3 rounded-full transition-transform"
              style={{
                backgroundColor: color,
                boxShadow: hoveredType === type ? `0 0 8px ${color}` : 'none',
                transform: hoveredType === type ? 'scale(1.2)' : 'scale(1)'
              }}
            />
            <span className={cn(
              "capitalize transition-colors",
              hoveredType === type ? "font-bold text-slate-900" : "text-slate-600"
            )}>
              {type === 'sports' ? '体育/场馆' : type === 'hotel' ? '酒店' : type === 'museum' ? '美术馆' : type === 'theatre' ? '剧院' : type === 'park' ? '公园' : '咖啡'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MapComponent;
