"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var L = __importStar(require("leaflet"));
var OverlappingMarkerSpiderfier = /** @class */ (function () {
    function OverlappingMarkerSpiderfier(map, opts) {
        if (opts === void 0) { opts = {}; }
        var _this = this;
        this.markers = [];
        this.markerListeners = [];
        this.listeners = {};
        this.spiderfying = false;
        this.spiderfied = false;
        this.unspiderfying = false;
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
        ['click', 'zoomend'].forEach(function (e) {
            return _this.map.addEventListener(e, function () { return _this.unspiderfy(); });
        });
    }
    OverlappingMarkerSpiderfier.prototype.initMarkerArrays = function () {
        this.markers = [];
        this.markerListeners = [];
    };
    OverlappingMarkerSpiderfier.prototype.addMarker = function (marker) {
        var _this = this;
        if (marker._oms)
            return this;
        marker._oms = true;
        var markerListener = function () { return _this.spiderListener(marker); };
        marker.addEventListener('click', markerListener);
        this.markerListeners.push({ marker: marker, listener: markerListener });
        this.markers.push(marker);
        return this;
    };
    OverlappingMarkerSpiderfier.prototype.getMarkers = function () {
        return __spreadArray([], this.markers, true);
    };
    OverlappingMarkerSpiderfier.prototype.removeMarker = function (marker) {
        if (marker._omsData)
            this.unspiderfy();
        var index = this.arrIndexOf(this.markers, marker);
        if (index < 0)
            return this;
        var listenerData = this.markerListeners.find(function (ml) { return ml.marker === marker; });
        if (listenerData) {
            marker.removeEventListener('click', listenerData.listener);
            this.markerListeners = this.markerListeners.filter(function (ml) { return ml !== listenerData; });
        }
        delete marker._oms;
        this.markers.splice(index, 1);
        return this;
    };
    OverlappingMarkerSpiderfier.prototype.clearMarkers = function () {
        var _this = this;
        this.unspiderfy();
        this.markers.forEach(function (marker, i) {
            var listenerData = _this.markerListeners.find(function (ml) { return ml.marker === marker; });
            if (listenerData) {
                marker.removeEventListener('click', listenerData.listener);
            }
            delete marker._oms;
        });
        this.initMarkerArrays();
        return this;
    };
    OverlappingMarkerSpiderfier.prototype.addListener = function (event, func) {
        if (!this.listeners[event])
            this.listeners[event] = [];
        this.listeners[event].push(func);
        return this;
    };
    OverlappingMarkerSpiderfier.prototype.removeListener = function (event, func) {
        var index = this.arrIndexOf(this.listeners[event], func);
        if (index >= 0)
            this.listeners[event].splice(index, 1);
        return this;
    };
    OverlappingMarkerSpiderfier.prototype.clearListeners = function (event) {
        this.listeners[event] = [];
        return this;
    };
    OverlappingMarkerSpiderfier.prototype.trigger = function (event) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        (this.listeners[event] || []).forEach(function (func) { return func.apply(void 0, args); });
    };
    OverlappingMarkerSpiderfier.prototype.generatePtsCircle = function (count, centerPt) {
        var _this = this;
        var circumference = this.circleFootSeparation * (2 + count);
        var legLength = circumference / (Math.PI * 2);
        var angleStep = (Math.PI * 2) / count;
        return Array.from({ length: count }, function (_, i) {
            var angle = _this.circleStartAngle + i * angleStep;
            return new L.Point(centerPt.x + legLength * Math.cos(angle), centerPt.y + legLength * Math.sin(angle));
        });
    };
    OverlappingMarkerSpiderfier.prototype.generatePtsSpiral = function (count, centerPt) {
        var _this = this;
        var angle = 0;
        var legLength = this.spiralLengthStart;
        return Array.from({ length: count }, function (_, i) {
            angle += _this.spiralFootSeparation / legLength + i * 0.0005;
            var pt = new L.Point(centerPt.x + legLength * Math.cos(angle), centerPt.y + legLength * Math.sin(angle));
            legLength += (Math.PI * 2 * _this.spiralLengthFactor) / angle;
            return pt;
        });
    };
    OverlappingMarkerSpiderfier.prototype.spiderListener = function (marker) {
        var _this = this;
        var markerSpiderfied = marker._omsData != null;
        if (!(markerSpiderfied && this.keepSpiderfied)) {
            this.unspiderfy();
        }
        if (markerSpiderfied) {
            this.trigger('click', marker);
        }
        else {
            var nearbyMarkerData_1 = [];
            var nonNearbyMarkers_1 = [];
            var pxSq_1 = this.nearbyDistance * this.nearbyDistance;
            var markerPt_1 = this.map.latLngToLayerPoint(marker.getLatLng());
            this.markers.forEach(function (m) {
                if (!_this.map.hasLayer(m))
                    return;
                var mPt = _this.map.latLngToLayerPoint(m.getLatLng());
                if (_this.ptDistanceSq(mPt, markerPt_1) < pxSq_1) {
                    nearbyMarkerData_1.push({ marker: m, markerPt: mPt });
                }
                else {
                    nonNearbyMarkers_1.push(m);
                }
            });
            if (nearbyMarkerData_1.length === 1) {
                this.trigger('click', marker);
            }
            else {
                this.spiderfy(nearbyMarkerData_1, nonNearbyMarkers_1);
            }
        }
    };
    OverlappingMarkerSpiderfier.prototype.makeHighlightListeners = function (marker) {
        var _this = this;
        return {
            highlight: function (event) {
                var data = marker._omsData;
                if (data && data.leg) {
                    data.leg.setStyle({
                        color: _this.legColors.highlighted,
                    });
                }
            },
            unhighlight: function (event) {
                var data = marker._omsData;
                if (data && data.leg) {
                    data.leg.setStyle({
                        color: _this.legColors.usual,
                    });
                }
            }
        };
    };
    OverlappingMarkerSpiderfier.prototype.spiderfy = function (markerData, nonNearbyMarkers) {
        var _this = this;
        this.spiderfying = true;
        var numFeet = markerData.length;
        var bodyPt = this.ptAverage(markerData.map(function (md) { return md.markerPt; }));
        var footPts = numFeet >= this.circleSpiralSwitchover
            ? this.generatePtsSpiral(numFeet, bodyPt).reverse()
            : this.generatePtsCircle(numFeet, bodyPt);
        var spiderfiedMarkers = footPts.map(function (footPt) {
            var footLl = _this.map.layerPointToLatLng(footPt);
            var nearestMarkerDatum = _this.minExtract(markerData, function (md) {
                return _this.ptDistanceSq(md.markerPt, footPt);
            });
            var marker = nearestMarkerDatum.marker;
            var leg = new L.Polyline([marker.getLatLng(), footLl], {
                color: _this.legColors.usual,
                weight: _this.legWeight,
                interactive: false
            });
            _this.map.addLayer(leg);
            marker._omsData = {
                usualPosition: marker.getLatLng(),
                leg: leg
            };
            if (_this.legColors.highlighted !== _this.legColors.usual) {
                var mhl = _this.makeHighlightListeners(marker);
                marker._omsData.highlightListeners = mhl;
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
    };
    OverlappingMarkerSpiderfier.prototype.unspiderfy = function (markerNotToMove) {
        var _this = this;
        if (this.unspiderfying || !this.spiderfied)
            return;
        this.unspiderfying = true;
        var unspiderfiedMarkers = [];
        this.markers.forEach(function (marker) {
            var data = marker._omsData;
            if (data) {
                _this.map.removeLayer(data.leg);
                if (marker !== markerNotToMove) {
                    marker.setLatLng(data.usualPosition);
                }
                marker.setZIndexOffset(0);
                var hl = data.highlightListeners;
                if (hl) {
                    marker.removeEventListener('mouseover', hl.highlight);
                    marker.removeEventListener('mouseout', hl.unhighlight);
                }
                delete marker._omsData;
                unspiderfiedMarkers.push(marker);
            }
        });
        delete this.unspiderfying;
        delete this.spiderfied;
        this.trigger('unspiderfy', unspiderfiedMarkers);
    };
    OverlappingMarkerSpiderfier.prototype.ptDistanceSq = function (pt1, pt2) {
        var dx = pt1.x - pt2.x;
        var dy = pt1.y - pt2.y;
        return dx * dx + dy * dy;
    };
    OverlappingMarkerSpiderfier.prototype.ptAverage = function (pts) {
        var sumPt = pts.reduce(function (acc, pt) { return new L.Point(acc.x + pt.x, acc.y + pt.y); }, new L.Point(0, 0));
        return new L.Point(sumPt.x / pts.length, sumPt.y / pts.length);
    };
    OverlappingMarkerSpiderfier.prototype.minExtract = function (set, func) {
        var bestIndex = 0;
        var bestVal = func(set[0]);
        set.forEach(function (item, i) {
            var val = func(item);
            if (val < bestVal) {
                bestVal = val;
                bestIndex = i;
            }
        });
        return set.splice(bestIndex, 1)[0];
    };
    OverlappingMarkerSpiderfier.prototype.arrIndexOf = function (arr, obj) {
        return arr.indexOf(obj);
    };
    OverlappingMarkerSpiderfier.VERSION = "1.0.0";
    return OverlappingMarkerSpiderfier;
}());
exports.default = OverlappingMarkerSpiderfier;
