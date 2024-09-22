import * as L from 'leaflet';

interface MarkerData {
    marker: L.Marker;
    markerPt: L.Point;
}

interface OmsData {
  usualPosition: L.LatLng;
  leg: L.Polyline;
  highlightListeners?: {
      highlight: (event: L.LeafletEvent) => void;
      unhighlight: (event: L.LeafletEvent) => void;
  };
}

interface OMSOptions {
    keepSpiderfied?: boolean;
    nearbyDistance?: number;
    circleSpiralSwitchover?: number;
    circleFootSeparation?: number;
    circleStartAngle?: number;
    spiralFootSeparation?: number;
    spiralLengthStart?: number;
    spiralLengthFactor?: number;
    legWeight?: number;
    legColors?: {
        usual: string;
        highlighted: string;
    };
}

declare module 'leaflet' {
  interface Marker {
      _omsData?: OmsData;
  }
}

export default class OverlappingMarkerSpiderfier {
    static VERSION = "1.0.0";
    private map: L.Map;
    private keepSpiderfied: boolean;
    private nearbyDistance: number;
    private circleSpiralSwitchover: number;
    private circleFootSeparation: number;
    private circleStartAngle: number;
    private spiralFootSeparation: number;
    private spiralLengthStart: number;
    private spiralLengthFactor: number;
    private legWeight: number;
    private legColors: { usual: string; highlighted: string };
    private markers: L.Marker[] = [];
    private markerListeners: Array<{ marker: L.Marker; listener: L.LeafletEventHandlerFn }> = [];
    private listeners: { [key: string]: Function[] } = {};
    private spiderfying?: boolean = false;
    private spiderfied?: boolean = false;
    private unspiderfying?: boolean = false;

    constructor(map: L.Map, opts: OMSOptions = {}) {
        this.map = map;
        this.keepSpiderfied = opts.keepSpiderfied || false;
        this.nearbyDistance = opts.nearbyDistance || 20;
        this.circleSpiralSwitchover = opts.circleSpiralSwitchover || 9;
        this.circleFootSeparation = opts.circleFootSeparation || 25;
        this.circleStartAngle = opts.circleStartAngle || (Math.PI * 2) / 12;
        this.spiralFootSeparation = opts.spiralFootSeparation || 28;
        this.spiralLengthStart = opts.spiralLengthStart || 11;
        this.spiralLengthFactor = opts.spiralLengthFactor || 5;
        this.legWeight = opts.legWeight || 1.5;
        this.legColors = opts.legColors || {
            usual: "#222",
            highlighted: "#f00"
        };

        this.initMarkerArrays();
        ['click', 'zoomend'].forEach((e) =>
            this.map.addEventListener(e, () => this.unspiderfy())
        );
    }

    private initMarkerArrays(): void {
        this.markers = [];
        this.markerListeners = [];
    }

    addMarker(marker: L.Marker): this {
        if ((marker as any)._oms) return this;
        (marker as any)._oms = true;

        const markerListener: L.LeafletEventHandlerFn = () => this.spiderListener(marker);
        marker.addEventListener('click', markerListener);
        this.markerListeners.push({ marker, listener: markerListener });
        this.markers.push(marker);
        return this;
    }

    getMarkers(): L.Marker[] {
        return [...this.markers];
    }

    removeMarker(marker: L.Marker): this {
        if ((marker as any)._omsData) this.unspiderfy();

        const index = this.arrIndexOf(this.markers, marker);
        if (index < 0) return this;

        const listenerData = this.markerListeners.find((ml) => ml.marker === marker);
        if (listenerData) {
            marker.removeEventListener('click', listenerData.listener);
            this.markerListeners = this.markerListeners.filter((ml) => ml !== listenerData);
        }
        delete (marker as any)._oms;
        this.markers.splice(index, 1);
        return this;
    }

    clearMarkers(): this {
        this.unspiderfy();
        this.markers.forEach((marker, i) => {
          const listenerData = this.markerListeners.find((ml) => ml.marker === marker);
          if (listenerData) {
              marker.removeEventListener('click', listenerData.listener);
          }
            delete (marker as any)._oms;
        });
        this.initMarkerArrays();
        return this;
    }

    addListener(event: string, func: Function): this {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(func);
        return this;
    }

    removeListener(event: string, func: Function): this {
        const index = this.arrIndexOf(this.listeners[event], func);
        if (index >= 0) this.listeners[event].splice(index, 1);
        return this;
    }

    clearListeners(event: string): this {
        this.listeners[event] = [];
        return this;
    }

    trigger(event: string, ...args: any[]): void {
        (this.listeners[event] || []).forEach((func) => func(...args));
    }

    private generatePtsCircle(count: number, centerPt: L.Point): L.Point[] {
        const circumference = this.circleFootSeparation * (2 + count);
        const legLength = circumference / (Math.PI * 2);
        const angleStep = (Math.PI * 2) / count;
        return Array.from({ length: count }, (_, i) => {
            const angle = this.circleStartAngle + i * angleStep;
            return new L.Point(
                centerPt.x + legLength * Math.cos(angle),
                centerPt.y + legLength * Math.sin(angle)
            );
        });
    }

    private generatePtsSpiral(count: number, centerPt: L.Point): L.Point[] {
        let angle = 0;
        let legLength = this.spiralLengthStart;
        return Array.from({ length: count }, (_, i) => {
            angle += this.spiralFootSeparation / legLength + i * 0.0005;
            const pt = new L.Point(
                centerPt.x + legLength * Math.cos(angle),
                centerPt.y + legLength * Math.sin(angle)
            );
            legLength += (Math.PI * 2 * this.spiralLengthFactor) / angle;
            return pt;
        });
    }

    private spiderListener(marker: L.Marker): void {
        const markerSpiderfied = (marker as any)._omsData != null;
        if (!(markerSpiderfied && this.keepSpiderfied)) {
            this.unspiderfy();
        }
        if (markerSpiderfied) {
            this.trigger('click', marker);
        } else {
            const nearbyMarkerData: MarkerData[] = [];
            const nonNearbyMarkers: L.Marker[] = [];
            const pxSq = this.nearbyDistance * this.nearbyDistance;
            const markerPt = this.map.latLngToLayerPoint(marker.getLatLng());
            this.markers.forEach((m) => {
                if (!this.map.hasLayer(m)) return;
                const mPt = this.map.latLngToLayerPoint(m.getLatLng());
                if (this.ptDistanceSq(mPt, markerPt) < pxSq) {
                    nearbyMarkerData.push({ marker: m, markerPt: mPt });
                } else {
                    nonNearbyMarkers.push(m);
                }
            });
            if (nearbyMarkerData.length === 1) {
                this.trigger('click', marker);
            } else {
                this.spiderfy(nearbyMarkerData, nonNearbyMarkers);
            }
        }
    }

    private makeHighlightListeners(marker: L.Marker) {
        return {
            highlight: (event: L.LeafletEvent) => {
                const data = marker._omsData;
                if (data && data.leg) {
                    data.leg.setStyle({
                        color: this.legColors.highlighted,
                    });
                }
            },
            unhighlight: (event: L.LeafletEvent) => {
                const data = marker._omsData;
                if (data && data.leg) {
                    data.leg.setStyle({
                        color: this.legColors.usual,
                    });
                }
            }
        };
    }
  

    private spiderfy(markerData: MarkerData[], nonNearbyMarkers: L.Marker[]): void {
        this.spiderfying = true;
        const numFeet = markerData.length;
        const bodyPt = this.ptAverage(markerData.map((md) => md.markerPt));
        const footPts =
            numFeet >= this.circleSpiralSwitchover
                ? this.generatePtsSpiral(numFeet, bodyPt).reverse()
                : this.generatePtsCircle(numFeet, bodyPt);

        const spiderfiedMarkers = footPts.map((footPt) => {
            const footLl = this.map.layerPointToLatLng(footPt);
            const nearestMarkerDatum = this.minExtract(markerData, (md) =>
                this.ptDistanceSq(md.markerPt, footPt)
            );
            const marker = nearestMarkerDatum.marker;
            const leg = new L.Polyline([marker.getLatLng(), footLl], {
                color: this.legColors.usual,
                weight: this.legWeight,
                interactive: false
            });
            this.map.addLayer(leg);
            (marker as any)._omsData = {
                usualPosition: marker.getLatLng(),
                leg: leg
            };
            if (this.legColors.highlighted !== this.legColors.usual) {
                const mhl = this.makeHighlightListeners(marker);
                (marker as any)._omsData.highlightListeners = mhl;
                marker.addEventListener('mouseover', mhl.highlight);
                marker.addEventListener('mouseout', mhl.unhighlight);
            }
            marker.setLatLng(footLl);
            marker.setZIndexOffset(1000000);
            return marker;
        });

        delete this.spiderfying;
        this.spiderfied = true;
        this.trigger('spiderfy', spiderfiedMarkers, nonNearbyMarkers);
    }

    unspiderfy(markerNotToMove?: L.Marker): void {
        if (this.unspiderfying || !this.spiderfied) return;
        this.unspiderfying = true;
        const unspiderfiedMarkers: L.Marker[] = [];

        this.markers.forEach((marker) => {
            const data = (marker as any)._omsData;
            if (data) {
                this.map.removeLayer(data.leg);
                if (marker !== markerNotToMove) {
                    marker.setLatLng(data.usualPosition);
                }
                marker.setZIndexOffset(0);
                const hl = data.highlightListeners;
                if (hl) {
                    marker.removeEventListener('mouseover', hl.highlight);
                    marker.removeEventListener('mouseout', hl.unhighlight);
                }
                delete (marker as any)._omsData;
                unspiderfiedMarkers.push(marker);
            }
        });

        delete this.unspiderfying;
        delete this.spiderfied;
        this.trigger('unspiderfy', unspiderfiedMarkers);
    }

    private ptDistanceSq(pt1: L.Point, pt2: L.Point): number {
        const dx = pt1.x - pt2.x;
        const dy = pt1.y - pt2.y;
        return dx * dx + dy * dy;
    }

    private ptAverage(pts: L.Point[]): L.Point {
        const sumPt = pts.reduce(
            (acc, pt) => new L.Point(acc.x + pt.x, acc.y + pt.y),
            new L.Point(0, 0)
        );
        return new L.Point(sumPt.x / pts.length, sumPt.y / pts.length);
    }

    private minExtract<T>(set: T[], func: (item: T) => number): T {
        let bestIndex = 0;
        let bestVal = func(set[0]);
        set.forEach((item, i) => {
            const val = func(item);
            if (val < bestVal) {
                bestVal = val;
                bestIndex = i;
            }
        });
        return set.splice(bestIndex, 1)[0];
    }

    private arrIndexOf<T>(arr: T[], obj: T): number {
        return arr.indexOf(obj);
    }
}

