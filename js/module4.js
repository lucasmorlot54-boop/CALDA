// ── Module 4 — Carte réseau interactive (prototype) ───────────────────────
// Indépendant des modules M0/M1/M2 (aucune référence à sousStations,
// donneesP2 ou hypotheses).
// Persistance : window.carteReseau, scopée par projet dans
// flux_project_{id} (contrairement au prototype FLUX d'origine qui utilisait
// une clé localStorage globale flux_m4_proto, partagée entre tous les
// projets — écart volontaire validé, cohérent avec le reste de CALDA).
// Bibliothèque : Leaflet 1.9.4 (window.L, chargé avant ce script).

window.carteReseau = {};

(function () {
  'use strict';

  const SNAP_TOLERANCE_PX        = 15;  // SST et segment
  const SNAP_TOLERANCE_VERTEX_PX = 25;  // vertex polyligne (priorité sur segment)

  // Table DN acier soudé standard — qmax = débit max à 2 m/s environ
  const M4_TABLE_DN = [
    { dn:  20, di:  21.6, qmax:   2.6 },
    { dn:  25, di:  27.2, qmax:   4.2 },
    { dn:  32, di:  35.9, qmax:   7.3 },
    { dn:  40, di:  41.8, qmax:   9.9 },
    { dn:  50, di:  53.0, qmax:  15.9 },
    { dn:  65, di:  68.9, qmax:  26.8 },
    { dn:  80, di:  80.9, qmax:  37.0 },
    { dn: 100, di: 105.3, qmax:  62.7 },
    { dn: 125, di: 130.0, qmax:  95.5 },
    { dn: 150, di: 155.5, qmax: 136.8 },
    { dn: 200, di: 206.5, qmax: 240.9 },
    { dn: 250, di: 260.4, qmax: 383.5 },
    { dn: 300, di: 309.7, qmax: 542.5 },
  ];

  // Couleurs par type de SST — reprennent la palette thermique CALDA
  // (Logement = --hot, Tertiaire = --cold, Industrie = --pill-gray-ink, Autre = --pill-purple-ink)
  const TYPE_COLORS = {
    'Logement':  '#d96a4f',
    'Tertiaire': '#2c6cb8',
    'Industrie': '#3a3d47',
    'Autre':     '#4a2f78',
  };

  // Fonds de carte disponibles
  const TILES = {
    osm: {
      url:     'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attr:    '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    },
    satellite: {
      url:     'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attr:    'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics',
      maxZoom: 18,
    },
    vide: null,
  };

  const DEFAULT_CENTER = [46.8, 2.5];
  const DEFAULT_ZOOM   = 6;

  // ── État ──────────────────────────────────────────────────────────────────
  let _map          = null;
  let _tileLayer    = null;
  let _mode         = null;    // 'add-sst' | 'trace' | 'delete' | null
  let _markers      = {};      // id → { id, marker, data, latlng }
  let _lines        = [];      // [{ id, points: [[lat,lng],...], poly }]
  let _nextId       = 1;
  let _editingId    = null;

  // Tracé polyligne en cours
  // null = pas de tracé ; sinon { points: [[lat,lng],...], polyTemp: L.Polyline|null }
  let _traceEnCours = null;
  let _snapTarget   = null;    // id SST actuellement sous le curseur (accrochage)
  let _tDepart      = 90;      // °C — température de départ réseau (paramètre global)
  let _labelsDN     = [];      // markers Leaflet des labels DN sur la carte

  // ── Initialisation (appelée depuis projects.js > DOMContentLoaded) ────────
  function initModule4() {
    const tabBtn = document.querySelector('.tab-btn[data-tab="m4"]');
    if (tabBtn) {
      tabBtn.addEventListener('click', () => requestAnimationFrame(_initMapOnce));
    }

    document.getElementById('m4-btn-add-sst')?.addEventListener('click', () => _setMode('add-sst'));
    document.getElementById('m4-btn-trace')?.addEventListener('click',   () => _setMode('trace'));
    document.getElementById('m4-btn-delete')?.addEventListener('click',  () => _setMode('delete'));
    document.getElementById('m4-btn-clear')?.addEventListener('click',   _clearAll);

    document.getElementById('m4-btn-trace-terminer')?.addEventListener('click', () => _finaliserTrace(false));
    document.getElementById('m4-btn-trace-annuler')?.addEventListener('click',  _annulerTrace);

    document.getElementById('m4-tile-select')?.addEventListener('change', (e) => {
      if (!_map) return;
      _applyTile(e.target.value);
    });

    document.getElementById('m4-edit-ok')?.addEventListener('click',     _editOk);
    document.getElementById('m4-edit-cancel')?.addEventListener('click', _editCancel);

    document.getElementById('m4-tdepart')?.addEventListener('input', function (e) {
      _tDepart = parseFloat(e.target.value) || 90;
      _save();
    });
  }

  // ── Initialisation carte (lazy, au premier affichage de l'onglet) ─────────
  function _initMapOnce() {
    if (_map) { _map.invalidateSize(); return; }

    _map = L.map('m4-map', { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM });
    _map.on('click',     _onMapClick);
    _map.on('mousemove', _onMapMouseMove);
    _map.on('dblclick',  _onMapDblClick);

    const saved   = _loadState();
    const tileKey = (saved && Object.prototype.hasOwnProperty.call(TILES, saved.tileKey))
      ? saved.tileKey : 'osm';
    const sel = document.getElementById('m4-tile-select');
    if (sel) sel.value = tileKey;
    _applyTile(tileKey, true);

    if (saved) {
      if (saved.center && saved.zoom) _map.setView(saved.center, saved.zoom);
      _nextId = saved.nextId || 1;
      if (saved.tDepart !== undefined) {
        _tDepart = saved.tDepart;
        const inp = document.getElementById('m4-tdepart');
        if (inp) inp.value = _tDepart;
      }
      (saved.ssts  || []).forEach(_restoreSst);
      (saved.lines || []).forEach(_restoreLine);
    }
    _renderRecap();
  }

  // ── Réinitialisation complète (changement de projet) ─────────────────────
  // Détruit l'instance Leaflet et l'état en mémoire pour forcer une
  // réinitialisation propre depuis window.carteReseau au prochain affichage
  // de l'onglet — nécessaire depuis que la carte est scopée par projet.
  function _resetModule4() {
    if (_map) {
      _map.off();
      _map.remove();
      _map = null;
    }
    _tileLayer    = null;
    _mode         = null;
    _markers      = {};
    _lines        = [];
    _nextId       = 1;
    _editingId    = null;
    _traceEnCours = null;
    _snapTarget   = null;
    _tDepart      = 90;
    _labelsDN     = [];
    _editCancel();
    const tdepartInp = document.getElementById('m4-tdepart');
    if (tdepartInp) tdepartInp.value = 90;
  }
  window.resetModule4 = _resetModule4;

  // ── Fonds de carte ────────────────────────────────────────────────────────
  function _applyTile(key, noSave) {
    if (_tileLayer) { _map.removeLayer(_tileLayer); _tileLayer = null; }
    const cfg = TILES[key];
    if (cfg) {
      _tileLayer = L.tileLayer(cfg.url, {
        attribution: cfg.attr,
        maxZoom:     cfg.maxZoom,
      }).addTo(_map);
    }
    if (!noSave) _save();
  }

  // ── Gestion des modes ─────────────────────────────────────────────────────
  function _setMode(mode) {
    // Toujours nettoyer le tracé en cours avant de changer de mode
    _annulerTraceInternal();

    _mode = (_mode === mode) ? null : mode;

    if (_mode) _editCancel();

    if (_mode === 'trace') {
      _traceEnCours = { points: [], polyTemp: null, snapsMeta: [] };
      if (_map) _map.doubleClickZoom.disable();
    }

    _majModeButtons();
    _majUiTrace();
  }

  function _majModeButtons() {
    ['add-sst', 'trace', 'delete'].forEach(m => {
      document.getElementById('m4-btn-' + m)?.classList.toggle('active', _mode === m);
    });
    const mapEl = document.getElementById('m4-map');
    if (mapEl) {
      mapEl.classList.toggle('m4-cursor-crosshair', _mode === 'add-sst' || _mode === 'trace');
      mapEl.classList.toggle('m4-cursor-delete',    _mode === 'delete');
    }
  }

  // Affiche/masque le bandeau d'info et les boutons Terminer/Annuler
  function _majUiTrace() {
    const enCours = _traceEnCours !== null;
    const hint    = document.getElementById('m4-trace-hint');
    const btnTerm = document.getElementById('m4-btn-trace-terminer');
    const btnAnnu = document.getElementById('m4-btn-trace-annuler');
    if (hint)    hint.style.display    = enCours ? '' : 'none';
    if (btnTerm) {
      btnTerm.style.display = enCours ? '' : 'none';
      btnTerm.disabled      = !enCours || (_traceEnCours.points.length < 2);
    }
    if (btnAnnu) btnAnnu.style.display = enCours ? '' : 'none';
  }

  // ── Événements carte ──────────────────────────────────────────────────────
  function _onMapClick(e) {
    if (_mode === 'add-sst') {
      _addSst(e.latlng);
      _setMode(null);
      return;
    }
    if (_mode === 'trace' && _traceEnCours) {
      // Priorité : SST > vertex polyligne > segment polyligne > clic libre
      const snapSst     = _detectSnap(e.latlng);
      const snapVertex  = snapSst                   ? null : _detectSnapVertex(e.latlng);
      const snapSegment = (snapSst || snapVertex)   ? null : _detectSnapSegment(e.latlng);
      let pt;
      let snapMeta = null;
      if (snapSst)         { pt = [snapSst.latlng.lat, snapSst.latlng.lng]; }
      else if (snapVertex)  { pt = [snapVertex.lat,  snapVertex.lng];  }
      else if (snapSegment) {
        pt       = [snapSegment.lat, snapSegment.lng];
        snapMeta = { type: 'segment', ligneId: snapSegment.ligneId, segmentIdx: snapSegment.segmentIdx };
      }
      else                  { pt = [e.latlng.lat,    e.latlng.lng];    }
      _traceEnCours.points.push(pt);
      _traceEnCours.snapsMeta.push(snapMeta);
      _redessinerPolyTemp();
      // Activer le bouton Terminer dès 2 points
      const btnTerm = document.getElementById('m4-btn-trace-terminer');
      if (btnTerm) btnTerm.disabled = _traceEnCours.points.length < 2;
    }
  }

  // Double-clic : finalise le tracé en cours
  // Les deux clics constitutifs ont déjà ajouté 2 points en double —
  // _finaliserTrace(true) retire ces 2 doublons avant de créer la polyligne finale.
  function _onMapDblClick(e) {
    if (_mode !== 'trace' || !_traceEnCours) return;
    L.DomEvent.stop(e);
    _finaliserTrace(true);
  }

  // Survol : accrochage visuel sur le marqueur SST le plus proche
  function _onMapMouseMove(e) {
    if (_mode !== 'trace' || !_traceEnCours) {
      if (_snapTarget) {
        _markers[_snapTarget]?.marker.getElement()
          ?.querySelector('.m4-marker')
          ?.classList.remove('m4-marker--snap');
        _snapTarget = null;
      }
      return;
    }
    const snap      = _detectSnap(e.latlng);
    const newSnapId = snap ? snap.id : null;
    if (_snapTarget !== newSnapId) {
      if (_snapTarget) {
        _markers[_snapTarget]?.marker.getElement()
          ?.querySelector('.m4-marker')
          ?.classList.remove('m4-marker--snap');
      }
      _snapTarget = newSnapId;
      if (_snapTarget) {
        _markers[_snapTarget]?.marker.getElement()
          ?.querySelector('.m4-marker')
          ?.classList.add('m4-marker--snap');
      }
    }
  }

  // ── Accrochage (snap) ─────────────────────────────────────────────────────
  // Retourne l'entrée _markers la plus proche si dans la tolérance, sinon null.
  function _detectSnap(latlng) {
    if (!_map) return null;
    const ptClic = _map.latLngToContainerPoint(latlng);
    let closest  = null;
    let minDist  = SNAP_TOLERANCE_PX;
    Object.values(_markers).forEach(function (entry) {
      const ptSst = _map.latLngToContainerPoint(entry.latlng);
      const dist  = ptClic.distanceTo(ptSst);
      if (dist < minDist) { minDist = dist; closest = entry; }
    });
    return closest;
  }

  // Retourne { lat, lng } du premier vertex de polyligne dans la tolérance, sinon null.
  // Parcourt uniquement les vertex (points cliqués), pas les segments.
  function _detectSnapVertex(latlng) {
    if (!_map) return null;
    const ptClic = _map.latLngToContainerPoint(latlng);
    for (var i = 0; i < _lines.length; i++) {
      var pts = _lines[i].points;
      for (var j = 0; j < pts.length; j++) {
        var ptV = _map.latLngToContainerPoint(L.latLng(pts[j][0], pts[j][1]));
        if (ptClic.distanceTo(ptV) <= SNAP_TOLERANCE_VERTEX_PX) {
          return { lat: pts[j][0], lng: pts[j][1] };
        }
      }
    }
    return null;
  }

  // Projection orthogonale de P sur le segment AB (coordonnées écran).
  // Retourne { x, y } clampé sur le segment (t ∈ [0,1]).
  function _projectionSurSegment(P, A, B) {
    var dx = B.x - A.x;
    var dy = B.y - A.y;
    var lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return { x: A.x, y: A.y };
    var t = ((P.x - A.x) * dx + (P.y - A.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return { x: A.x + t * dx, y: A.y + t * dy };
  }

  // Retourne { lat, lng, ligneId, segmentIdx } de la projection orthogonale
  // la plus proche sur un segment de polyligne existante dans la tolérance, sinon null.
  // ligneId et segmentIdx permettent l'insertion de vertex (jonction T).
  function _detectSnapSegment(latlng) {
    if (!_map) return null;
    var ptClic   = _map.latLngToContainerPoint(latlng);
    var best     = null;
    var bestDist = SNAP_TOLERANCE_PX;
    var bestI    = -1;
    var bestJ    = -1;
    for (var i = 0; i < _lines.length; i++) {
      var pts = _lines[i].points;
      for (var j = 0; j < pts.length - 1; j++) {
        var A    = _map.latLngToContainerPoint(L.latLng(pts[j][0],   pts[j][1]));
        var B    = _map.latLngToContainerPoint(L.latLng(pts[j+1][0], pts[j+1][1]));
        var proj = _projectionSurSegment(ptClic, A, B);
        var dx   = ptClic.x - proj.x;
        var dy   = ptClic.y - proj.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < bestDist) { bestDist = dist; best = proj; bestI = i; bestJ = j; }
      }
    }
    if (!best) return null;
    var ll = _map.containerPointToLatLng(L.point(best.x, best.y));
    return { lat: ll.lat, lng: ll.lng, ligneId: _lines[bestI].id, segmentIdx: bestJ };
  }

  // ── Tracé polyligne ───────────────────────────────────────────────────────
  function _redessinerPolyTemp() {
    if (!_traceEnCours) return;
    if (_traceEnCours.polyTemp) {
      _map.removeLayer(_traceEnCours.polyTemp);
      _traceEnCours.polyTemp = null;
    }
    if (_traceEnCours.points.length >= 2) {
      _traceEnCours.polyTemp = L.polyline(_traceEnCours.points, {
        color: '#888', weight: 2.5, dashArray: '6 8', opacity: 0.8,
      }).addTo(_map);
    }
  }

  // Finalise le tracé : crée la polyligne permanente.
  // fromDblClick = true → retire les 2 derniers points (doublons des clics constitutifs).
  function _finaliserTrace(fromDblClick) {
    if (!_traceEnCours) return;

    if (_traceEnCours.polyTemp) {
      _map.removeLayer(_traceEnCours.polyTemp);
      _traceEnCours.polyTemp = null;
    }

    const pts   = fromDblClick
      ? _traceEnCours.points.slice(0, -2)
      : _traceEnCours.points.slice();
    const metas = fromDblClick
      ? (_traceEnCours.snapsMeta || []).slice(0, -2)
      : (_traceEnCours.snapsMeta || []).slice();

    _traceEnCours = null;
    if (_map) _map.doubleClickZoom.enable();
    _clearSnapHighlight();

    if (pts.length < 2) {
      _mode = null;
      _majModeButtons();
      _majUiTrace();
      return;
    }

    // Insertion vertex dans polylignes existantes aux jonctions T (snap segment)
    var metaDebut = metas[0];
    var metaFin   = metas[metas.length - 1];
    if (metaDebut && metaDebut.type === 'segment') {
      _insererVertexDansLigne(metaDebut.ligneId, metaDebut.segmentIdx, pts[0]);
    }
    if (metaFin && metaFin.type === 'segment') {
      // Si les deux extrémités snappent sur la même polyligne, l'insertion
      // du premier point décale segmentIdx du second si celui-ci est plus loin.
      var idxFin = metaFin.segmentIdx;
      if (metaDebut && metaDebut.type === 'segment' &&
          metaDebut.ligneId === metaFin.ligneId &&
          metaFin.segmentIdx > metaDebut.segmentIdx) {
        idxFin++;
      }
      _insererVertexDansLigne(metaFin.ligneId, idxFin, pts[pts.length - 1]);
    }

    const id   = 'm4-l-' + (_nextId++);
    const poly = L.polyline(pts, {
      color: '#374151', weight: 2.5, opacity: 0.85,
    }).addTo(_map);
    poly.on('click', function (e) {
      if (_mode === 'delete') {
        L.DomEvent.stopPropagation(e);
        _deleteLine(id);
        _setMode(null);
      }
    });

    _lines.push({ id: id, points: pts, poly: poly });
    _mode = null;
    _majModeButtons();
    _majUiTrace();
    _save();
  }

  // Insère un vertex au milieu d'une polyligne existante pour créer une jonction T.
  // Invisible visuellement — la polyligne suit le même tracé, avec un nœud partagé en plus.
  function _insererVertexDansLigne(ligneId, segmentIdx, point) {
    var ligne = _lines.find(function (l) { return l.id === ligneId; });
    if (!ligne) return;
    if (segmentIdx < 0 || segmentIdx >= ligne.points.length - 1) return;
    // Ne pas insérer si le point est déjà présent (dans 1 cm)
    var PREC = 1e-7;
    for (var k = 0; k < ligne.points.length; k++) {
      if (Math.abs(ligne.points[k][0] - point[0]) < PREC &&
          Math.abs(ligne.points[k][1] - point[1]) < PREC) return;
    }
    ligne.points.splice(segmentIdx + 1, 0, [point[0], point[1]]);
    if (ligne.poly) ligne.poly.setLatLngs(ligne.points);
  }

  // Annulation du tracé (bouton "Annuler le tracé")
  function _annulerTrace() {
    _annulerTraceInternal();
    _mode = null;
    _majModeButtons();
    _majUiTrace();
  }

  // Nettoyage interne — appelé par _setMode et _clearAll
  function _annulerTraceInternal() {
    if (!_traceEnCours) return;
    if (_traceEnCours.polyTemp) {
      _map.removeLayer(_traceEnCours.polyTemp);
    }
    _traceEnCours = null;
    if (_map) _map.doubleClickZoom.enable();
    _clearSnapHighlight();
  }

  function _clearSnapHighlight() {
    if (_snapTarget) {
      _markers[_snapTarget]?.marker.getElement()
        ?.querySelector('.m4-marker')
        ?.classList.remove('m4-marker--snap');
      _snapTarget = null;
    }
  }

  // ── SST : création, placement, rafraîchissement, suppression ──────────────
  function _addSst(latlng) {
    const id   = 'm4-' + (_nextId++);
    const data = { nom: 'SST', puissance: '', type: 'Logement' };
    _placeSst(id, latlng, data);
    _save();
    _openEditPanel(id);
  }

  function _placeSst(id, latlng, data) {
    const color = TYPE_COLORS[data.type] || '#6B7280';
    const abbr  = _abbrev(data.nom);
    const icon  = L.divIcon({
      className:   '',
      html:        '<div class="m4-marker" style="background:' + color + '">' +
                   '<span class="m4-marker-label">' + abbr + '</span></div>',
      iconSize:    [34, 34],
      iconAnchor:  [17, 17],
      popupAnchor: [0, -22],
    });

    const marker = L.marker(latlng, { icon }).addTo(_map);

    marker.bindTooltip(function () {
      const entry = _markers[id];
      if (!entry) return '';
      const d = entry.data;
      return '<strong>' + (d.nom || 'SST') + '</strong>' +
        (d.puissance !== '' && d.puissance != null ? '<br>' + d.puissance + ' kW' : '') +
        '<br><em>' + (d.type || '') + '</em>';
    }, { direction: 'top', offset: [0, -8] });

    marker.on('click', function (e) {
      L.DomEvent.stopPropagation(e);
      _onMarkerClick(id);
    });

    _markers[id] = { id: id, marker: marker, data: data, latlng: latlng };
  }

  function _refreshSst(id) {
    const entry = _markers[id];
    if (!entry) return;
    const latlng = entry.latlng;
    const data   = entry.data;
    _map.removeLayer(entry.marker);
    delete _markers[id];
    _placeSst(id, latlng, data);
  }

  function _onMarkerClick(id) {
    if (_mode === 'delete') {
      _deleteSst(id);
      _setMode(null);
      return;
    }
    if (_mode === 'trace' && _traceEnCours) {
      // Clic direct sur un marqueur SST = accrochage explicite
      const entry = _markers[id];
      if (entry) {
        _traceEnCours.points.push([entry.latlng.lat, entry.latlng.lng]);
        _traceEnCours.snapsMeta.push(null);
        _redessinerPolyTemp();
        const btnTerm = document.getElementById('m4-btn-trace-terminer');
        if (btnTerm) btnTerm.disabled = _traceEnCours.points.length < 2;
      }
      return;
    }
    // Mode normal → ouvrir le panneau d'édition
    _openEditPanel(id);
  }

  function _deleteSst(id) {
    const entry = _markers[id];
    if (!entry) return;
    _map.removeLayer(entry.marker);
    delete _markers[id];
    _save();
  }

  function _restoreSst(d) {
    _placeSst(d.id, L.latLng(d.latlng[0], d.latlng[1]), d.data);
  }

  // ── Lignes ────────────────────────────────────────────────────────────────
  function _deleteLine(id) {
    const idx = _lines.findIndex(function (l) { return l.id === id; });
    if (idx === -1) return;
    _map.removeLayer(_lines[idx].poly);
    _lines.splice(idx, 1);
    _save();
  }

  // Restauration — nouveau format : l.points [[lat,lng],...]
  // Ancien format (fromId/toId, sans points) : ignoré (migration silencieuse)
  function _restoreLine(l) {
    if (!l.points || l.points.length < 2) return;
    const poly = L.polyline(l.points, {
      color: '#374151', weight: 2.5, opacity: 0.85,
    }).addTo(_map);
    poly.on('click', function (e) {
      if (_mode === 'delete') {
        L.DomEvent.stopPropagation(e);
        _deleteLine(l.id);
        _setMode(null);
      }
    });
    _lines.push({ id: l.id, points: l.points, poly: poly });
  }

  // ── Panneau d'édition SST ─────────────────────────────────────────────────
  function _openEditPanel(id) {
    _editingId = id;
    const data  = (_markers[id] && _markers[id].data) || {};
    const nomEl = document.getElementById('m4-edit-nom');
    const pwrEl = document.getElementById('m4-edit-puissance');
    const retEl = document.getElementById('m4-edit-tRetour');
    const typEl = document.getElementById('m4-edit-type');
    const panel = document.getElementById('m4-edit-panel');
    if (nomEl)  nomEl.value  = data.nom || '';
    if (pwrEl)  pwrEl.value  = (data.puissance != null && data.puissance !== '') ? data.puissance : '';
    if (retEl)  retEl.value  = (data.tRetour  != null && data.tRetour  !== '') ? data.tRetour  : 60;
    if (typEl)  typEl.value  = data.type || 'Logement';
    if (panel)  panel.style.display = '';
  }

  function _editOk() {
    if (!_editingId) return;
    const entry = _markers[_editingId];
    if (entry) {
      const nomVal = (document.getElementById('m4-edit-nom')?.value || '').trim();
      const pwrRaw = parseFloat(document.getElementById('m4-edit-puissance')?.value);
      const retRaw = parseFloat(document.getElementById('m4-edit-tRetour')?.value);
      entry.data.nom       = nomVal || 'SST';
      entry.data.puissance = isNaN(pwrRaw) ? '' : pwrRaw;
      entry.data.tRetour   = isNaN(retRaw) ? 60 : retRaw;
      entry.data.type      = document.getElementById('m4-edit-type')?.value || 'Logement';
      _refreshSst(_editingId);
    }
    _editCancel();
    _save();
  }

  function _editCancel() {
    _editingId = null;
    const panel = document.getElementById('m4-edit-panel');
    if (panel) panel.style.display = 'none';
  }

  // ── Effacer tout ──────────────────────────────────────────────────────────
  function _clearAll() {
    if (!_map) return;
    if (!window.confirm('Effacer toutes les sous-stations et lignes de la carte de ce projet ?')) return;
    _annulerTraceInternal();
    Object.values(_markers).forEach(function (e) { _map.removeLayer(e.marker); });
    _lines.forEach(function (l) { _map.removeLayer(l.poly); });
    _markers = {};
    _lines   = [];
    _nextId  = 1;
    _mode    = null;
    _majModeButtons();
    _majUiTrace();
    _editCancel();
    _save();
  }

  // ── Persistance ───────────────────────────────────────────────────────────
  // Scopée par projet via window.carteReseau (voir projects.js :
  // getProjectData / saveCurrentProjectData / openProject).
  function _save() {
    if (!_map) return;
    const c = _map.getCenter();
    window.carteReseau = {
      tileKey:  (document.getElementById('m4-tile-select') || {}).value || 'osm',
      center:   [c.lat, c.lng],
      zoom:     _map.getZoom(),
      nextId:   _nextId,
      tDepart:  _tDepart,
      ssts: Object.values(_markers).map(function (e) {
        return { id: e.id, latlng: [e.latlng.lat, e.latlng.lng], data: e.data };
      }),
      // points [[lat,lng],...] (pas de fromId/toId)
      lines: _lines.map(function (l) {
        return { id: l.id, points: l.points };
      }),
    };
    if (typeof saveCurrentProjectData === 'function') saveCurrentProjectData();
    _renderRecap();
  }

  function _loadState() {
    const d = window.carteReseau;
    return (d && Object.keys(d).length) ? d : null;
  }

  // ── Validation réseau ─────────────────────────────────────────────────────
  // Retourne { ok: true } ou { ok: false, message: '...' }.
  // Critères : ≥1 SST, ≥1 ligne, chaque SST est vertex d'une ligne,
  // exactement 1 extrémité libre (sans SST), graphe connexe.
  function _validerReseau() {
    var ssts = Object.values(_markers);
    if (ssts.length === 0) return { ok: false, message: 'Aucune sous-station placée.' };
    if (_lines.length === 0) return { ok: false, message: 'Aucun tracé réseau.' };

    function eq(a, b) {
      return Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;
    }
    function posKey(p) {
      return p[0].toFixed(7) + ',' + p[1].toFixed(7);
    }

    // Vérifier que chaque SST est vertex d'au moins une polyligne
    var sstNonRelies = ssts.filter(function (s) {
      var p = [s.latlng.lat, s.latlng.lng];
      return !_lines.some(function (l) {
        return l.points.some(function (v) { return eq(v, p); });
      });
    });
    if (sstNonRelies.length > 0) {
      return {
        ok: false,
        message: 'Sous-station(s) non reliée(s) au réseau : ' +
          sstNonRelies.map(function (s) { return s.data.nom || 'SST'; }).join(', '),
      };
    }

    // Extrémités des polylignes (premier et dernier vertex, dédupliquées)
    var endpoints = [];
    _lines.forEach(function (l) {
      if (l.points.length >= 2) {
        endpoints.push(l.points[0]);
        endpoints.push(l.points[l.points.length - 1]);
      }
    });
    var uniqueEp = [];
    endpoints.forEach(function (ep) {
      if (!uniqueEp.some(function (u) { return eq(u, ep); })) uniqueEp.push(ep);
    });

    // Extrémités sans SST = extrémités libres (doit y en avoir exactement 1)
    var sstPos = ssts.map(function (s) { return [s.latlng.lat, s.latlng.lng]; });
    var libres = uniqueEp.filter(function (ep) {
      if (sstPos.some(function (p) { return eq(p, ep); })) return false;
      // Compter les occurrences dans TOUS les vertex de TOUTES les polylignes.
      // Si count >= 2 : l'endpoint est partagé (jonction T ou nœud multiple) → pas libre.
      var count = 0;
      _lines.forEach(function (l) {
        l.points.forEach(function (v) { if (eq(v, ep)) count++; });
      });
      return count <= 1;
    });
    if (libres.length === 0) {
      return {
        ok: false,
        message: 'Aucune extrémité libre — le réseau doit avoir exactement 1 entrée (point non rattaché à une SST).',
      };
    }
    if (libres.length > 1) {
      return {
        ok: false,
        message: libres.length + ' extrémités libres détectées. Le réseau doit avoir exactement 1 entrée.',
      };
    }

    // Connexité : BFS sur le graphe des segments
    var adj = {};
    function addAdj(a, b) {
      var ka = posKey(a), kb = posKey(b);
      if (!adj[ka]) adj[ka] = [];
      if (!adj[kb]) adj[kb] = [];
      adj[ka].push(kb);
      adj[kb].push(ka);
    }
    _lines.forEach(function (l) {
      for (var i = 0; i < l.points.length - 1; i++) addAdj(l.points[i], l.points[i + 1]);
    });
    var startKey = posKey([ssts[0].latlng.lat, ssts[0].latlng.lng]);
    var visited = {};
    var queue = [startKey];
    visited[startKey] = true;
    while (queue.length > 0) {
      var curr = queue.shift();
      (adj[curr] || []).forEach(function (nb) {
        if (!visited[nb]) { visited[nb] = true; queue.push(nb); }
      });
    }
    var unreachable = ssts.filter(function (s) {
      return !visited[posKey([s.latlng.lat, s.latlng.lng])];
    });
    if (unreachable.length > 0) {
      return {
        ok: false,
        message: 'Réseau non connexe — sous-station(s) isolée(s) : ' +
          unreachable.map(function (s) { return s.data.nom || 'SST'; }).join(', '),
      };
    }

    return { ok: true };
  }

  // ── Tableau récapitulatif dimensionnement ─────────────────────────────────
  // Q [m³/h] = P [kW] × 3600 / (rho × Cp × ΔT) = P × 3600 / (1000 × 4,186 × ΔT)
  // Exemple : 250 kW / ΔT 30 K → 250 × 3600 / (1000 × 4,186 × 30) = 7,165 m³/h
  function _renderRecap() {
    var errorEl = document.getElementById('m4-recap-error');
    var tableEl = document.getElementById('m4-recap-table');
    if (!errorEl || !tableEl) return;

    _clearLabelsDN();   // nettoyer les labels DN avant chaque re-rendu

    var v = _validerReseau();
    if (!v.ok) {
      errorEl.textContent  = v.message;
      errorEl.style.display = '';
      tableEl.style.display = 'none';
      _hideTroncons();
      return;
    }
    errorEl.style.display = 'none';
    tableEl.style.display = '';

    var ssts   = Object.values(_markers);
    var tbody  = tableEl.querySelector('tbody');
    var tfoot  = tableEl.querySelector('tfoot');
    if (!tbody) return;
    tbody.innerHTML = '';

    var totalP = 0;
    var totalQ = 0;

    ssts.forEach(function (s) {
      var p    = parseFloat(s.data.puissance);
      var tRet = parseFloat(s.data.tRetour);
      if (isNaN(p))    p    = 0;
      if (isNaN(tRet)) tRet = 60;
      var dt = _tDepart - tRet;
      var q  = (p > 0 && dt > 0) ? (p * 3600 / (1000 * 4.186 * dt)) : 0;
      totalP += p;
      if (q > 0) totalQ += q;

      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + (s.data.nom || 'SST') + '</td>' +
        '<td class="m4-col-r">' + (p > 0 ? p.toFixed(0) : '—') + '</td>' +
        '<td class="m4-col-r">' + tRet + '</td>' +
        '<td class="m4-col-r">' + (q > 0 ? q.toFixed(2) : '—') + '</td>';
      tbody.appendChild(tr);
    });

    if (tfoot) {
      tfoot.innerHTML =
        '<tr class="m4-recap-total">' +
        '<td><strong>Total</strong></td>' +
        '<td class="m4-col-r"><strong>' + (totalP > 0 ? totalP.toFixed(0) + ' kW' : '—') + '</strong></td>' +
        '<td></td>' +
        '<td class="m4-col-r"><strong>' + (totalQ > 0 ? totalQ.toFixed(2) + ' m³/h' : '—') + '</strong></td>' +
        '</tr>';
    }

    // Vérification ΔT > 0 avant topologie
    var dtInvalid = ssts.filter(function (s) {
      var tRet = parseFloat(s.data.tRetour);
      if (isNaN(tRet)) tRet = 60;
      return (_tDepart - tRet) <= 0;
    });
    if (dtInvalid.length > 0) {
      errorEl.textContent = 'ΔT ≤ 0 pour : ' +
        dtInvalid.map(function (s) { return s.data.nom || 'SST'; }).join(', ') +
        ' — T retour ≥ T départ.';
      errorEl.style.display = '';
      _hideTroncons();
      return;
    }

    var graphe   = _construireGraphe();
    var entree   = _trouverEntree(graphe);
    if (!entree.ok) {
      errorEl.textContent = entree.message;
      errorEl.style.display = '';
      _hideTroncons();
      return;
    }
    var parcours = _parcourirArbre(graphe, entree.racine);
    var prop     = _propagerDebits(graphe, parcours);

    _renderTronconsTable(graphe, parcours, prop.debitsMap);
    _majLabelsDN(graphe, parcours, prop.debitsMap);
  }

  function _hideTroncons() {
    var t  = document.getElementById('m4-troncons-title');
    var el = document.getElementById('m4-troncons-table');
    if (t)  t.style.display  = 'none';
    if (el) el.style.display = 'none';
  }

  function _clearLabelsDN() {
    if (_map) _labelsDN.forEach(function (lbl) { _map.removeLayer(lbl); });
    _labelsDN = [];
  }

  function _posKey(p) {
    return p[0].toFixed(7) + ',' + p[1].toFixed(7);
  }

  function _edgeKey(a, b) {
    return a < b ? a + '|' + b : b + '|' + a;
  }

  function _construireGraphe() {
    var nodes = {};
    var edges = [];
    var adj   = {};
    function addNode(lat, lng) {
      var k = _posKey([lat, lng]);
      if (!nodes[k]) nodes[k] = { lat: lat, lng: lng, key: k, sstId: null };
      return k;
    }
    function addAdj(a, b) {
      if (!adj[a]) adj[a] = [];
      if (!adj[b]) adj[b] = [];
      if (adj[a].indexOf(b) < 0) adj[a].push(b);
      if (adj[b].indexOf(a) < 0) adj[b].push(a);
    }
    _lines.forEach(function (l) {
      for (var i = 0; i < l.points.length; i++) {
        var ka = addNode(l.points[i][0], l.points[i][1]);
        if (i < l.points.length - 1) {
          var kb = addNode(l.points[i + 1][0], l.points[i + 1][1]);
          edges.push({ nodeA: ka, nodeB: kb });
          addAdj(ka, kb);
        }
      }
    });
    Object.keys(_markers).forEach(function (id) {
      var entry = _markers[id];
      var k = _posKey([entry.latlng.lat, entry.latlng.lng]);
      if (nodes[k]) nodes[k].sstId = entry.id;
    });
    return { nodes: nodes, edges: edges, adj: adj };
  }

  function _trouverEntree(graphe) {
    var degre = {};
    graphe.edges.forEach(function (e) {
      degre[e.nodeA] = (degre[e.nodeA] || 0) + 1;
      degre[e.nodeB] = (degre[e.nodeB] || 0) + 1;
    });
    var candidats = Object.keys(graphe.nodes).filter(function (k) {
      return (degre[k] || 0) === 1 && !graphe.nodes[k].sstId;
    });
    if (candidats.length === 0) return { ok: false, message: 'Aucune extremite libre detectee.' };
    if (candidats.length > 1)  return { ok: false, message: candidats.length + ' extremites libres — exactement 1 requise.' };
    return { ok: true, racine: candidats[0] };
  }

  function _parcourirArbre(graphe, racine) {
    var parent   = {};
    var children = {};
    var visited  = {};
    var ordre    = [];
    var file     = [racine];
    parent[racine]  = null;
    visited[racine] = true;
    while (file.length > 0) {
      var cur = file.shift();
      children[cur] = children[cur] || [];
      ordre.push(cur);
      (graphe.adj[cur] || []).forEach(function (v) {
        if (!visited[v]) {
          visited[v] = true;
          parent[v]  = cur;
          children[cur].push(v);
          file.push(v);
        }
      });
    }
    return { parent: parent, children: children, visited: visited, ordre: ordre };
  }

  function _propagerDebits(graphe, parcours) {
    var debitsMap = {};
    function calcQ(nodeKey) {
      var q    = 0;
      var node = graphe.nodes[nodeKey];
      if (node.sstId) {
        var entry = _markers[node.sstId];
        if (entry) {
          var p    = parseFloat(entry.data.puissance) || 0;
          var tRet = parseFloat(entry.data.tRetour);
          if (isNaN(tRet)) tRet = 60;
          var dt   = _tDepart - tRet;
          if (p > 0 && dt > 0) q += p * 3600 / (1000 * 4.186 * dt);
        }
      }
      (parcours.children[nodeKey] || []).forEach(function (child) {
        var qChild = calcQ(child);
        q += qChild;
        debitsMap[_edgeKey(nodeKey, child)] = qChild;
      });
      return q;
    }
    var qTotal = calcQ(parcours.ordre[0]);
    return { debitsMap: debitsMap, qTotal: qTotal };
  }

  function _selectionnerDN(q) {
    for (var i = 0; i < M4_TABLE_DN.length; i++) {
      if (M4_TABLE_DN[i].qmax >= q) {
        return { dn: M4_TABLE_DN[i].dn, di: M4_TABLE_DN[i].di, hors: false };
      }
    }
    var last = M4_TABLE_DN[M4_TABLE_DN.length - 1];
    return { dn: last.dn, di: last.di, hors: true };
  }

  function _vitesse(q, di) {
    var section = Math.PI * Math.pow(di / 1000, 2) / 4;
    return q / (3600 * section);
  }

  function _renderTronconsTable(graphe, parcours, debitsMap) {
    var titleEl = document.getElementById('m4-troncons-title');
    var tableEl = document.getElementById('m4-troncons-table');
    if (!tableEl) return;
    if (titleEl) titleEl.style.display = '';
    tableEl.style.display = '';
    var tbody = tableEl.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    var num = 1;
    parcours.ordre.forEach(function (nodeKey) {
      (parcours.children[nodeKey] || []).forEach(function (child) {
        var ek  = _edgeKey(nodeKey, child);
        var q   = debitsMap[ek] || 0;
        var sel = _selectionnerDN(q);
        var v   = q > 0 ? _vitesse(q, sel.di) : 0;
        var childNode = graphe.nodes[child];
        var label = 'Troncon ' + (num++);
        if (childNode.sstId) {
          var entry = _markers[childNode.sstId];
          if (entry) label = entry.data.nom || 'SST';
        }
        var dnTxt = q > 0 ? ('DN ' + sel.dn + (sel.hors ? ' !' : '')) : '—';
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + label + '</td>' +
          '<td class="m4-col-r">' + (q > 0 ? q.toFixed(2) : '—') + '</td>' +
          '<td class="m4-col-r">' + dnTxt + '</td>' +
          '<td class="m4-col-r">' + (q > 0 ? v.toFixed(2) : '—') + '</td>';
        tbody.appendChild(tr);
      });
    });
  }

  function _majLabelsDN(graphe, parcours, debitsMap) {
    if (!_map) return;
    _clearLabelsDN();
    parcours.ordre.forEach(function (nodeKey) {
      (parcours.children[nodeKey] || []).forEach(function (child) {
        var ek  = _edgeKey(nodeKey, child);
        var q   = debitsMap[ek] || 0;
        if (q <= 0) return;
        var sel = _selectionnerDN(q);
        var nA  = graphe.nodes[nodeKey];
        var nB  = graphe.nodes[child];
        var lbl = L.marker(
          [(nA.lat + nB.lat) / 2, (nA.lng + nB.lng) / 2],
          { icon: L.divIcon({ className: '', html: '', iconSize: [0, 0] }), interactive: false }
        ).bindTooltip(
          'DN ' + sel.dn + (sel.hors ? ' !' : ''),
          { permanent: true, direction: 'center', className: 'm4-label-dn' }
        ).addTo(_map);
        _labelsDN.push(lbl);
      });
    });
  }

  // ── Helper : abréviation du nom ───────────────────────────────────────────
  function _abbrev(nom) {
    if (!nom || !nom.trim()) return '?';
    const parts = nom.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
    return parts.slice(0, 3).map(function (p) {
      return p.charAt(0).toUpperCase();
    }).join('');
  }

  // ── Export ────────────────────────────────────────────────────────────────
  window.initModule4 = initModule4;

})();
