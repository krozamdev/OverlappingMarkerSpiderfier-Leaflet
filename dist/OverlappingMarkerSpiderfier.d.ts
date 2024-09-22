import * as L from 'leaflet';
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
    static VERSION: string;
    private map;
    private keepSpiderfied;
    private nearbyDistance;
    private circleSpiralSwitchover;
    private circleFootSeparation;
    private circleStartAngle;
    private spiralFootSeparation;
    private spiralLengthStart;
    private spiralLengthFactor;
    private legWeight;
    private legColors;
    private markers;
    private markerListeners;
    private listeners;
    private spiderfying?;
    private spiderfied?;
    private unspiderfying?;
    constructor(map: L.Map, opts?: OMSOptions);
    private initMarkerArrays;
    addMarker(marker: L.Marker): this;
    getMarkers(): L.Marker[];
    removeMarker(marker: L.Marker): this;
    clearMarkers(): this;
    addListener(event: string, func: Function): this;
    removeListener(event: string, func: Function): this;
    clearListeners(event: string): this;
    trigger(event: string, ...args: any[]): void;
    private generatePtsCircle;
    private generatePtsSpiral;
    private spiderListener;
    private makeHighlightListeners;
    private spiderfy;
    unspiderfy(markerNotToMove?: L.Marker): void;
    private ptDistanceSq;
    private ptAverage;
    private minExtract;
    private arrIndexOf;
}
export {};
