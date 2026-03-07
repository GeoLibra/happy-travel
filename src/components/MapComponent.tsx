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

const getLabelContent = (loc: Location, state: 'normal' | 'hovered' | 'selected') => {
  const isF1Circuit = loc.name.includes('赛车场') || loc.name.includes('F1');
  const isImagineDragons = loc.description?.includes('Imagine Dragons');
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

  // Special styling for Imagine Dragons Concert
  if (isImagineDragons) {
    const pulseAnimation = state === 'selected' ? 'animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;' : '';
    return `
      <div style="position: relative; width: ${size + 8}px; height: ${size + 8}px;">
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: linear-gradient(135deg, #9333ea 0%, #ec4899 50%, #f97316 100%);
          width: ${size + 4}px;
          height: ${size + 4}px;
          border-radius: 50%;
          ${pulseAnimation}
        "></div>
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background-color: ${TYPE_COLORS[loc.type]};
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          border: ${border}px solid white;
          ${extraStyle}
        "></div>
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: white;
          font-size: ${size * 0.6}px;
          font-weight: 900;
        ">♪</div>
      </div>
    `;
  }

  // Special styling for F1 Circuit - Use F1 car icon
  if (isF1Circuit) {
    const pulseAnimation = state === 'selected' ? 'animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;' : '';
    const carSize = state === 'selected' ? size + 12 : state === 'hovered' ? size + 8 : size + 4;
    return `
      <div style="position: relative; width: ${carSize}px; height: ${carSize}px;">
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: conic-gradient(from 0deg, #E10600 0%, #FFB800 50%, #001A30 100%);
          width: ${carSize}px;
          height: ${carSize}px;
          border-radius: 50%;
          ${pulseAnimation}
        "></div>
        <svg width="${carSize}" height="${carSize}" viewBox="0 0 60 60" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">
          <!-- F1 Car Icon -->
          <g transform="translate(10, 20) scale(0.15)">
            <!-- Rear Wing -->
            <rect x="10" y="15" width="20" height="5" fill="#001A30" />
            <path d="M10 20 L25 20 L25 35 L10 35 Z" fill="#E10600" />

            <!-- Main Body -->
            <path d="M20 35 L60 25 L120 25 L150 15 L180 30 L210 35 L230 40 L230 45 L10 45 Z" fill="#001A30"/>

            <!-- Livery Stripes -->
            <path d="M60 25 L120 25 L150 15 L200 30" stroke="#FFB800" stroke-width="3" fill="none"/>
            <path d="M30 35 L120 30 L160 20 L210 35" stroke="#E10600" stroke-width="2" fill="none"/>

            <!-- Front Wing -->
            <path d="M210 38 L235 38 L235 45 L210 45 Z" fill="#001A30"/>
            <path d="M210 40 L235 40 L235 43 L210 43 Z" fill="#E10600"/>

            <!-- Wheels -->
            <circle cx="45" cy="45" r="14" fill="#111"/>
            <circle cx="45" cy="45" r="7" fill="#FFB800"/>
            <circle cx="185" cy="45" r="14" fill="#111"/>
            <circle cx="185" cy="45" r="7" fill="#FFB800"/>

            <!-- Number 1 -->
            <text x="85" y="32" fill="#FFB800" font-size="11" font-weight="900" font-style="italic">#1</text>
          </g>
        </svg>
      </div>
    `;
  }

  return `<div style="background-color: ${TYPE_COLORS[loc.type]}; width: ${size}px; height: ${size}px; border-radius: 50%; border: ${border}px solid white; ${extraStyle}"></div>`;
};

const getLabelStyle = (state: 'normal' | 'hovered' | 'selected') => {
  const isSelected = state === 'selected';
  const isHovered = state === 'hovered';

  return {
    fontSize: isSelected ? 16 : 14, // Increase base size
    fontWeight: isSelected ? '900' : '800', // Make it bolder
    fillColor: isSelected ? '#1e3a8a' : '#0f172a', // Darker, richer text color
    strokeColor: '#ffffff', // Solid white stroke/halo
    strokeWidth: isSelected ? 4 : 3, // Thicker stroke for better readability over varied map backgrounds
    padding: [2, 5],
  };
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
  const labelsLayer = useRef<any>(null);
  const markersRef = useRef<{ [key: string]: any }>({});
  const [isMapReady, setIsMapReady] = useState(false);
  const [showPOI, setShowPOI] = useState(false);

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

        // Add LabelsLayer for only text collision
        const layer = new AMap.LabelsLayer({
          zooms: [3, 20],
          zIndex: 1000,
          collision: true, // Enable strict collision detection for labels
        });
        map.add(layer);
        labelsLayer.current = layer;

        // Add Markers and Text Labels
        locations.forEach((loc) => {
          // 1. The always-visible dot (Marker)
          const marker = new AMap.Marker({
            position: new AMap.LngLat(loc.coordinates[0], loc.coordinates[1]),
            content: getLabelContent(loc, 'normal'),
            anchor: 'center',
            zIndex: 10,
          });

          // 2. The collidable text (LabelMarker)
          const labelMarker = new AMap.LabelMarker({
            name: loc.name,
            position: [loc.coordinates[0], loc.coordinates[1]],
            text: {
              content: loc.name,
              direction: 'bottom',
              offset: [0, 5],
              style: getLabelStyle('normal'),
            },
            extData: { id: loc.id },
            zooms: [3, 20],
            rank: 1, // Manage collision priority
          });

          const handleClick = () => {
            if (onMarkerClick) onMarkerClick(loc);
          };

          marker.on('click', handleClick);
          labelMarker.on('click', handleClick);

          marker.setMap(map);
          layer.add(labelMarker);

          markersRef.current[loc.id] = { marker, labelMarker };
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

    Object.entries(markersRef.current).forEach(([id, elements]: [string, any]) => {
      const { marker, labelMarker } = elements;
      const loc = locations.find(l => l.id === id);
      if (!loc) return;

      const isSelected = id === selectedLocationId;
      const isHoveredType = loc.type === hoveredType;

      if (isSelected) {
        marker.setContent(getLabelContent(loc, 'selected'));
        marker.setzIndex(100);

        labelMarker.setText({
          content: loc.name,
          direction: 'bottom',
          offset: [0, 8],
          style: getLabelStyle('selected'),
        });
        labelMarker.setzIndex(100);

        amapInstance.current.setCenter(new AMap.LngLat(loc.coordinates[0], loc.coordinates[1]));
      } else if (isHoveredType) {
        marker.setContent(getLabelContent(loc, 'hovered'));
        marker.setzIndex(90);

        labelMarker.setText({
          content: loc.name,
          direction: 'bottom',
          offset: [0, 5],
          style: getLabelStyle('hovered'),
        });
        labelMarker.setzIndex(90);
      } else {
        marker.setContent(getLabelContent(loc, 'normal'));
        marker.setzIndex(10);

        labelMarker.setText({
          content: loc.name,
          direction: 'bottom',
          offset: [0, 5],
          style: getLabelStyle('normal'),
        });
        labelMarker.setzIndex(10);
      }
    });
  }, [selectedLocationId, hoveredType, locations, isMapReady]);

  // Update POI visibility when toggled
  useEffect(() => {
    if (!amapInstance.current || !isMapReady) return;

    if (showPOI) {
      amapInstance.current.setFeatures(['bg', 'road', 'building', 'point']);
    } else {
      amapInstance.current.setFeatures(['bg', 'road', 'building']);
    }
  }, [showPOI, isMapReady]);

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden shadow-inner bg-slate-100 relative touch-none">
      <div ref={mapRef} className="w-full h-full" />
      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur p-3 rounded-xl shadow-lg border border-slate-200 text-xs z-10 min-w-[110px]">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
          <span className="font-bold text-slate-800 text-sm">图例</span>
          <label className="flex items-center cursor-pointer opacity-70 hover:opacity-100 transition-opacity ml-2">
            <span className="mr-1.5 text-slate-500 font-medium text-[10px]">地点</span>
            <div className={`relative inline-block w-6 h-[14px] transition-colors duration-200 ease-in-out rounded-full ${showPOI ? 'bg-blue-400' : 'bg-slate-300'}`}>
              <div
                className={`absolute left-[2px] top-[2px] w-2.5 h-2.5 bg-white rounded-full transition-transform duration-200 ease-in-out transform ${showPOI ? 'translate-x-2.5' : 'translate-x-0'}`}
              />
            </div>
            <input
              type="checkbox"
              className="sr-only"
              checked={showPOI}
              onChange={(e) => setShowPOI(e.target.checked)}
            />
          </label>
        </div>
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
              {type === 'sports' ? '体育/场馆' : type === 'hotel' ? '酒店' : type === 'museum' ? '美术馆' : type === 'theatre' ? '剧院' : type === 'park' ? '公园' : type === 'cafe' ? '咖啡' : type === 'restaurant' ? '餐厅' : '其他'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MapComponent;
