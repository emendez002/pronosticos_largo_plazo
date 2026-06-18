window.GM_CONFIG = {"title": "pronosticos_largo_plazo", "description": "", "crsName": "EPSG:4326 — WGS 84", "basemap": "osm", "colors": {"primary": "#2c7fb8", "accent": "#f03b20"}, "logo": "assets/logo.png", "controls": {"zoom": true, "pan": true, "scale": true, "legend": true, "layers": true, "locate": false, "measure": false, "fullscreen": true, "minimap": false}, "bounds": [[6.307988918312277, -87.68814653037418], [12.33558929267262, -80.33858380118255]], "layers": [{"id": "buffer25km_crc_033ccaa7_c777_44fc_b5ff_6d816a057532", "name": "buffer25km_crc", "kind": "vector", "src": "data/layer_0.js", "dataVar": "GM_LAYER_0", "style": {"geom": "polygon", "mode": "single", "field": null, "single": {"fill": "#ff9e17", "fillOpacity": 1.0, "stroke": "#232323", "weight": 1, "opacity": 1.0, "radius": 6}, "categories": []}, "popupFields": [], "visible": true}, {"id": "Google_Hybrid_f35911d7_6cb0_4cd0_a167_0274aab5a42a", "name": "Google Hybrid", "kind": "raster", "image": "data/raster_1.png", "bounds": [[-85.0511287798066, -180.0], [85.0511287798066, 180.0]], "opacity": 1.0, "visible": true}]};


(function () {
    var cfg = window.GM_CONFIG;

    var map = L.map('map', {
        zoomControl: !!cfg.controls.zoom,
        dragging: cfg.controls.pan !== false,
        fullscreenControl: false
    });

    // --- Mapa base ---
    var basemaps = {
        osm: {
            url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            opts: { maxZoom: 19, attribution: '&copy; OpenStreetMap' }
        },
        positron: {
            url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
            opts: { maxZoom: 20, attribution: '&copy; OpenStreetMap, &copy; CARTO' }
        },
        dark: {
            url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
            opts: { maxZoom: 20, attribution: '&copy; OpenStreetMap, &copy; CARTO' }
        },
        topo: {
            url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
            opts: { maxZoom: 17, attribution: '&copy; OpenTopoMap (CC-BY-SA)' }
        },
        satellite: {
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            opts: { maxZoom: 19, attribution: 'Tiles &copy; Esri' }
        }
    };
    var baseLayer = null;
    if (cfg.basemap && cfg.basemap !== 'none' && basemaps[cfg.basemap]) {
        var b = basemaps[cfg.basemap];
        baseLayer = L.tileLayer(b.url, b.opts).addTo(map);
    }

    // --- Estilos ---
    // Cada elemento trae su propio estilo en properties._gm (calculado por el
    // renderizador real de QGIS). Si no, se usa el estilo único de la capa.
    function featStyle(lc, feature) {
        var s = (feature && feature.properties && feature.properties._gm)
            ? feature.properties._gm
            : (lc.style && lc.style.single) || {};
        return {
            color: s.stroke, weight: s.weight, opacity: s.opacity,
            fillColor: s.fill, fillOpacity: s.fillOpacity,
            radius: s.radius || 6
        };
    }

    function popupHtml(feature, fields) {
        if (!feature || !feature.properties) { return ''; }
        var rows = '';
        for (var i = 0; i < fields.length; i++) {
            var k = fields[i];
            if (k === '_gm') { continue; }
            var val = feature.properties[k];
            if (val === null || val === undefined) { val = ''; }
            rows += '<tr><td class="k">' + k + '</td><td>' + String(val) + '</td></tr>';
        }
        return '<table>' + rows + '</table>';
    }

    // --- Capas ---
    // cfg.layers viene en el orden de QGIS: índice 0 = capa superior.
    // Cada capa va en su propio "pane" para poder conservar el orden y
    // controlar su transparencia y su posición desde el panel web.
    var gmLayers = [];
    cfg.layers.forEach(function (lc, i) {
        var pane = 'gmpane_' + i;
        map.createPane(pane);
        var layer;
        if (lc.kind === 'raster') {
            layer = L.imageOverlay(lc.image, lc.bounds, { pane: pane });
        } else {
            var data = window[lc.dataVar];
            if (!data) { return; }
            layer = L.geoJSON(data, {
                pane: pane,
                style: function (f) { return featStyle(lc, f); },
                pointToLayer: function (f, latlng) {
                    var st = featStyle(lc, f);
                    return L.circleMarker(latlng, {
                        pane: pane, radius: st.radius,
                        color: st.color, weight: st.weight, opacity: st.opacity,
                        fillColor: st.fillColor, fillOpacity: st.fillOpacity
                    });
                },
                onEachFeature: function (f, lyr) {
                    var html = popupHtml(f, lc.popupFields || []);
                    if (html) { lyr.bindPopup(html); }
                }
            });
        }
        layer.addTo(map);
        gmLayers.push({ lc: lc, layer: layer, pane: pane,
                        visible: lc.visible !== false, opacity: 1 });
    });

    // Orden visible: primero del arreglo = capa de arriba.
    var gmOrder = gmLayers.map(function (_g, i) { return i; });

    function gmApplyZ() {
        for (var k = 0; k < gmOrder.length; k++) {
            var gl = gmLayers[gmOrder[k]];
            var p = map.getPane(gl.pane);
            if (p) { p.style.zIndex = 500 + (gmOrder.length - k); }
        }
    }
    function gmApplyVis(gl) {
        var p = map.getPane(gl.pane);
        if (p) { p.style.display = gl.visible ? '' : 'none'; }
    }
    function gmApplyOpacity(gl) {
        var p = map.getPane(gl.pane);
        if (p) { p.style.opacity = gl.opacity; }
    }
    gmApplyZ();
    gmLayers.forEach(function (gl) { gmApplyVis(gl); });

    // --- Encuadre: mismo zoom y límites de la vista de QGIS ---
    if (cfg.bounds) {
        map.fitBounds(cfg.bounds);
    } else {
        map.setView([0, 0], 2);
    }

    // --- Controles ---
    if (cfg.controls.scale) {
        L.control.scale({ imperial: false }).addTo(map);
    }
    if (cfg.controls.layers && gmLayers.length) {
        var layersCtl = L.control({ position: 'topright' });
        layersCtl.onAdd = function () {
            var d = L.DomUtil.create('div', 'gm-layers');
            L.DomEvent.disableClickPropagation(d);
            L.DomEvent.disableScrollPropagation(d);

            function move(k, dir) {
                var nk = k + dir;
                if (nk < 0 || nk >= gmOrder.length) { return; }
                var tmp = gmOrder[k]; gmOrder[k] = gmOrder[nk]; gmOrder[nk] = tmp;
                gmApplyZ();
                render();
            }

            function render() {
                var html = '<h4>Capas</h4>';
                for (var k = 0; k < gmOrder.length; k++) {
                    var idx = gmOrder[k];
                    var gl = gmLayers[idx];
                    html += '<div class="gm-lrow">'
                        + '<div class="gm-lhead">'
                        + '<button class="gm-mv" data-k="' + k + '" data-dir="-1" title="Subir">▲</button>'
                        + '<button class="gm-mv" data-k="' + k + '" data-dir="1" title="Bajar">▼</button>'
                        + '<label><input type="checkbox" class="gm-vis" data-i="' + idx + '"'
                        + (gl.visible ? ' checked' : '') + '> ' + gl.lc.name + '</label>'
                        + '</div>'
                        + '<input type="range" class="gm-op" min="0" max="100" value="'
                        + Math.round(gl.opacity * 100) + '" data-i="' + idx + '">'
                        + '</div>';
                }
                if (baseLayer) {
                    html += '<div class="gm-lrow"><label><input type="checkbox" id="gm-base" checked>'
                        + ' Mapa base</label></div>';
                }
                d.innerHTML = html;

                var mvs = d.querySelectorAll('.gm-mv');
                for (var a = 0; a < mvs.length; a++) {
                    mvs[a].addEventListener('click', function (e) {
                        move(parseInt(e.target.getAttribute('data-k'), 10),
                             parseInt(e.target.getAttribute('data-dir'), 10));
                    });
                }
                var vis = d.querySelectorAll('.gm-vis');
                for (var b = 0; b < vis.length; b++) {
                    vis[b].addEventListener('change', function (e) {
                        var gl = gmLayers[parseInt(e.target.getAttribute('data-i'), 10)];
                        gl.visible = e.target.checked;
                        gmApplyVis(gl);
                    });
                }
                var ops = d.querySelectorAll('.gm-op');
                for (var c = 0; c < ops.length; c++) {
                    ops[c].addEventListener('input', function (e) {
                        var gl = gmLayers[parseInt(e.target.getAttribute('data-i'), 10)];
                        gl.opacity = parseInt(e.target.value, 10) / 100;
                        gmApplyOpacity(gl);
                    });
                }
                var base = d.querySelector('#gm-base');
                if (base) {
                    base.addEventListener('change', function (e) {
                        if (e.target.checked) { map.addLayer(baseLayer); }
                        else { map.removeLayer(baseLayer); }
                    });
                }
            }

            render();
            return d;
        };
        layersCtl.addTo(map);
    }
    if (cfg.controls.fullscreen && L.control.fullscreen) {
        L.control.fullscreen({ title: 'Pantalla completa' }).addTo(map);
    }
    if (cfg.controls.locate && L.control.locate) {
        L.control.locate({
            position: 'topleft',
            strings: { title: 'Mi ubicación (GPS)' },
            flyTo: true
        }).addTo(map);
    }
    if (cfg.controls.measure && L.control.measure) {
        L.control.measure({
            primaryLengthUnit: 'meters', secondaryLengthUnit: 'kilometers',
            primaryAreaUnit: 'sqmeters', secondaryAreaUnit: 'hectares',
            activeColor: cfg.colors.accent, completedColor: cfg.colors.primary,
            localization: 'es'
        }).addTo(map);
    }
    if (cfg.controls.minimap && L.Control && L.Control.MiniMap && baseLayer) {
        var b2 = (function () {
            var bm = basemaps[cfg.basemap] || basemaps.osm;
            return L.tileLayer(bm.url, bm.opts);
        })();
        new L.Control.MiniMap(b2, { toggleDisplay: true }).addTo(map);
    }

    // --- Título ---
    if (cfg.title) {
        var titleCtl = L.control({ position: 'topright' });
        titleCtl.onAdd = function () {
            var d = L.DomUtil.create('div', 'gm-title');
            d.textContent = cfg.title;
            return d;
        };
        titleCtl.addTo(map);
    }

    // --- Leyenda / simbología ---
    if (cfg.controls.legend) {
        var legend = L.control({ position: 'bottomright' });
        legend.onAdd = function () {
            var d = L.DomUtil.create('div', 'gm-legend');
            var html = '<h4>Leyenda</h4>';
            cfg.layers.forEach(function (lc) {
                if (lc.kind === 'raster') {
                    html += '<div class="row"><span class="swatch" style="background:repeating-linear-gradient(45deg,#bbb,#bbb 4px,#ddd 4px,#ddd 8px)"></span>' + lc.name + '</div>';
                    return;
                }
                var ls = lc.style;
                if (ls.mode === 'categorized' && ls.categories.length) {
                    html += '<div style="font-weight:600;margin-top:4px">' + lc.name + '</div>';
                    ls.categories.forEach(function (c) {
                        html += '<div class="row"><span class="swatch" style="background:' + c.fill + '"></span>' + (c.label || c.value) + '</div>';
                    });
                } else {
                    html += '<div class="row"><span class="swatch" style="background:' + ls.single.fill + '"></span>' + lc.name + '</div>';
                }
            });
            d.innerHTML = html;
            L.DomEvent.disableClickPropagation(d);
            return d;
        };
        legend.addTo(map);
    }

    // --- Logo ---
    if (cfg.logo) {
        var logo = L.control({ position: 'bottomleft' });
        logo.onAdd = function () {
            var d = L.DomUtil.create('div', 'gm-logo');
            d.innerHTML = '<img src="' + cfg.logo + '" alt="logo"/>';
            return d;
        };
        logo.addTo(map);
    }
})();
