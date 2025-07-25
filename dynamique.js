// Liste des années pour l'animation
const years = ['2005', '2008', '2010', '2014', '2016', '2018', '2022', '2024'];
const yearDisplayDuration = 2000; // Durée d'affichage d'une année (couche d'occupation)
const changeDisplayDuration = 3000; // Durée d'affichage de la couche de changement (moins longue que 10s pour un clignotement + visible)
const initialDelay = 3000; // Délai initial avant le début de la boucle

// Variables pour la carte et les couches
let map;
let currentLayer;
let blinkingLayer;
let currentYearIndex = 0;
let animationTimeout; // Utilisé pour les setTimeout de l'animation
let isPlaying = true;

// Variables pour les éléments du DOM (slider et affichage des données)
let yearSlider;
let sliderYearLabel;
let playPauseBtn;
let prevBtn;
let nextBtn;
// Suppression de 'dataYearTitle' ici car il sera interne au contrôle de superficie Leaflet
// let dataYearTitle; 
let superficieControl; // Nouvelle variable pour le contrôle Leaflet des superficies

// NOUVEAU : Variable pour votre fichier audio d'animation
let mainAnimationAudio;
// CHEMIN CORRIGÉ : Votre fichier 'Song_site.mp3' est dans le dossier 'data'
const audioFilePath = '../data/Song_site.mp3'; 

// Fonction pour initialiser la carte Leaflet
function initMap() {
    map = L.map('map').setView([6.45, 2.45], 13);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);
    
    // --- Légende des Occupations du lac ---
    const legendDataOccupation = [
        { label: 'Acadjas', color: '#e8633f', classValue: 3 },
        { label: 'Eau', color: '#7fdfff', classValue: 1 },
        { label: 'Jacinthe d\'eau', color: '#52dc2e', classValue: 2 },
        { label: 'Habitation', color: '#dc1010', classValue: 4 }
    ];

    const legendOccupation = L.control({ position: 'topleft' });

    legendOccupation.onAdd = function (map) {
        const div = L.DomUtil.create('div', 'info legend');
        let legendHTML = '<h4>Occupation du lac Nokoué</h4>';
        legendDataOccupation.forEach(item => {
            legendHTML += `<i style="background:${item.color}"></i> ${item.label}<br>`;
        });
        div.innerHTML = legendHTML;
        return div;
    };
    legendOccupation.addTo(map);

    // --- Légende des Changements ---
    const legendDataChange = [
        { label: 'Acadja vers Eau', color: '#1f78b4' },
        { label: 'Acadja vers Jacinthe d\'eau', color: '#ffd700' },
        { label: 'Eau vers Acadja', color: '#d3a145' },
        { label: 'Eau vers Jacinthe d\'eau', color: '#3affa3' },
        { label: 'Jacinthe d\'eau vers Acadja', color: '#fd6fda' },
        { label: 'Jacinthe d\'eau vers Eau', color: '#1e90ff' }
    ];

    const legendChange = L.control({ position: 'topleft' });

    legendChange.onAdd = function (map) {
        const div = L.DomUtil.create('div', 'info legend');
        let legendHTML = '<h4>Changements</h4>';
        legendDataChange.forEach(item => {
            legendHTML += `<i style="background:${item.color};"></i> ${item.label}<br>`;
        });
        div.innerHTML = legendHTML;
        return div;
    };
    legendChange.addTo(map);

    // --- NOUVEAU : Contrôle Leaflet pour l'affichage des Superficies ---
    // Positionnement en haut à droite pour être opposé à la légende principale
    superficieControl = L.control({ position: 'topright' }); 

    superficieControl.onAdd = function (map) {
        const div = L.DomUtil.create('div', 'info legend-superficie'); 
        div.innerHTML = `
            <h3 id="superficie-title">Superficie (<span id="data-year-display">Chargement...</span>)</h3> 
            <p>Acadjas: <span id="surface-acadjas">Chargement...</span> km²</p>
            <p>Eau: <span id="surface-eau">Chargement...</span> km²</p>
            <p>Jacinthe d'eau: <span id="surface-jacinthe">Chargement...</span> km²</p>
            <p>Habitation: <span id="surface-habitation">Chargement...</span> km²</p>
        `;
        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);
        return div;
    };
    superficieControl.addTo(map); 

    // Initialisation des éléments du DOM pour le slider et les boutons
    yearSlider = document.getElementById('year-slider');
    sliderYearLabel = document.getElementById('slider-year-label');
    playPauseBtn = document.getElementById('play-pause-btn');
    prevBtn = document.getElementById('prev-btn');
    nextBtn = document.getElementById('next-btn');

    // NOUVEAU : Initialisation de l'objet Audio pour l'animation principale
    mainAnimationAudio = new Audio(audioFilePath);
    mainAnimationAudio.loop = true; // Le son se répète en boucle
    mainAnimationAudio.volume = 0.6; // Volume par défaut, ajustez si besoin (entre 0.0 et 1.0)

    // Configuration du slider
    yearSlider.max = years.length - 1;
    yearSlider.value = currentYearIndex;
    sliderYearLabel.textContent = years[currentYearIndex];

    // Écouteurs d'événements pour le slider et les boutons
    yearSlider.addEventListener('input', function() {
        pauseAnimation(); // Ceci va aussi pauser l'audio
        currentYearIndex = parseInt(this.value);
        updateMapAndData(currentYearIndex);
        if (isPlaying) { // Si l'animation était en mode lecture avant la manipulation du slider
            // La lecture audio reprendra via resumeAnimation appelée lors du déclenchement automatique de la séquence
            // ou si l'utilisateur appuie à nouveau sur play
            mainAnimationAudio.play().catch(e => console.log("Erreur lecture audio (slider):", e));
        }
    });

    playPauseBtn.addEventListener('click', function() {
        if (isPlaying) {
            pauseAnimation(); // Ceci va pauser l'audio
        } else {
            resumeAnimation(); // Ceci va relancer l'audio
            // IMPORTANT : La lecture doit être initiée par une interaction utilisateur.
            // Le .play() ici gère le cas du premier clic sur "Play".
            mainAnimationAudio.play().catch(e => console.log("Erreur lecture audio (play/pause):", e));
        }
    });

    prevBtn.addEventListener('click', function() {
        pauseAnimation(); // Ceci va pauser l'audio
        currentYearIndex = (currentYearIndex - 1 + years.length) % years.length;
        updateMapAndData(currentYearIndex);
        if (isPlaying) { // Si l'animation était en mode lecture avant le clic sur prev
            mainAnimationAudio.play().catch(e => console.log("Erreur lecture audio (prev):", e));
        }
    });

    nextBtn.addEventListener('click', function() {
        pauseAnimation(); // Ceci va pauser l'audio
        currentYearIndex = (currentYearIndex + 1) % years.length;
        updateMapAndData(currentYearIndex);
        if (isPlaying) { // Si l'animation était en mode lecture avant le clic sur next
            mainAnimationAudio.play().catch(e => console.log("Erreur lecture audio (next):", e));
        }
    });

    startInitialAnimation();
}

async function startInitialAnimation() {
    await updateMapAndData(currentYearIndex);
    // NOUVEAU : Lance l'audio si l'animation est censée démarrer en "jouant".
    // Note : Le navigateur peut bloquer la lecture si ce n'est pas initié par un clic direct.
    // Les clics sur les contrôles (play/pause, next/prev, slider) sont des déclencheurs plus fiables.
    if (isPlaying) { 
        mainAnimationAudio.play().catch(e => console.log("Erreur lecture audio (initial):", e));
    }
    animationTimeout = setTimeout(animateSequenceLoop, initialDelay);
}

async function updateMapAndData(index) {
    if (blinkingLayer) {
        map.removeLayer(blinkingLayer);
        blinkingLayer = null;
    }

    const year = years[index];
    sliderYearLabel.textContent = year;
    yearSlider.value = index;

    document.getElementById('data-year-display').textContent = year; 

    await loadGeoJSON(year);
    await updateQuantitativeData(year);
}

function pauseAnimation() {
    isPlaying = false;
    playPauseBtn.textContent = 'Play';
    if (animationTimeout) {
        clearTimeout(animationTimeout);
    }
    // NOUVEAU : Mettre l'audio en pause
    mainAnimationAudio.pause();
}

function resumeAnimation() {
    isPlaying = true;
    playPauseBtn.textContent = 'Pause';
    // NOUVEAU : Reprendre l'audio
    // Cette fonction sera appelée par les clics des boutons, assurant le bon déroulement de l'audio.
    mainAnimationAudio.play().catch(e => console.log("Erreur lecture audio (resume):", e));
    animateSequenceLoop();
}

async function animateSequenceLoop() {
    if (!isPlaying) {
        // NOUVEAU : S'assurer que l'audio est en pause si l'animation s'arrête en cours de boucle
        mainAnimationAudio.pause(); 
        return;
    }

    await updateMapAndData(currentYearIndex); 

    const nextYearIndex = (currentYearIndex + 1) % years.length;

    if (currentYearIndex < years.length - 1) {
        animationTimeout = setTimeout(async () => {
            if (!isPlaying) {
                mainAnimationAudio.pause(); // S'assurer que l'audio est en pause
                return;
            }

            const startYear = years[currentYearIndex];
            const endYear = years[nextYearIndex];

            await loadBlinkingLayer(startYear, endYear);

            animationTimeout = setTimeout(async () => {
                if (!isPlaying) {
                    mainAnimationAudio.pause(); // S'assurer que l'audio est en pause
                    return;
                }

                currentYearIndex = nextYearIndex;
                animateSequenceLoop();
            }, changeDisplayDuration);

        }, yearDisplayDuration);
    } else {
        animationTimeout = setTimeout(() => {
            if (!isPlaying) {
                mainAnimationAudio.pause(); // S'assurer que l'audio est en pause
                return;
            }

            currentYearIndex = 0;
            animateSequenceLoop();
        }, yearDisplayDuration);
    }
}

function styleFeatures(feature) {
    let color;
    switch (feature.properties.Classvalue) {
        case 1: 
            color = '#e8633f'; // Eau
            break;
        case 2: 
            color = '#7fdfff'; // Jacinthe d'eau
            break;
        case 3: 
            color = '#52dc2e'; // Acadjas
            break;
        case 4: 
            color = '#dc1010'; // Habitation
            break;
        default:
            color = '#e8633f';
    }
    return {
        fillColor: color,
        weight: 0,
        opacity: 1,
        color: color,
        fillOpacity: 0.7
    };
}

function styleChangeFeatures(feature) {
    let borderColor;
    switch (feature.properties.DN) {
        case 11: // Acadja vers Eau
            borderColor = '#1f78b4';
            break;
        case 16: // Acadja vers Jacinthe d'eau
            borderColor = '#ffd700';
            break;
        case 7: // Eau vers Acadja
            borderColor = '#d3a145';
            break;
        case 17: // Eau vers Jacinthe d'eau
            borderColor = '#3affa3';
            break;
        case 8: // Jacinthe d'eau vers Acadja
            borderColor = '#fd6fda';
            break;
        case 13: // Jacinthe d'eau vers Eau
            borderColor = '#1e90ff';
            break;
        default:
            borderColor = 'gray';
    }
    return {
        fillColor: 'transparent',
        weight: 0.55,
        opacity: 1,
        color: borderColor,
        fillOpacity: 0
    };
}

async function loadGeoJSON(year) {
    try {
        const response = await fetch(`../data/${year}.geojson`);
        const data = await response.json();
        
        if (currentLayer) {
            map.removeLayer(currentLayer);
        }

        currentLayer = L.geoJSON(data, {
            style: styleFeatures
        }).addTo(map);

        map.fitBounds(currentLayer.getBounds(), {
            padding: [0, 0], 
            maxZoom: 14       
        });
        
    } catch (error) {
        console.error(`Erreur lors du chargement du fichier GeoJSON pour ${year}:`, error);
    }
}

async function loadBlinkingLayer(startYear, endYear) {
    try {
        const response = await fetch(`../data/changement_${startYear}_${endYear}.geojson`);
        const data = await response.json();
        
        if (blinkingLayer) {
            map.removeLayer(blinkingLayer);
            blinkingLayer = null;
        }
        
        blinkingLayer = L.geoJSON(data, {
            style: styleChangeFeatures
        }).addTo(map);
        
        blinkingLayer.getLayers().forEach(layer => {
            layer._path.classList.add('blink-layer');
        });

    } catch (error) {
        console.error(`Erreur lors du chargement de la couche de changement ${startYear}-${endYear}:`, error);
    }
}

// Fonction pour calculer et afficher les données quantitatives
async function updateQuantitativeData(year) {
    try {
        const response = await fetch(`../data/${year}.geojson`);
        const data = await response.json();

        let totalAcadjas_m2 = 0;
        let totalEau_m2 = 0;
        let totalJacinthe_m2 = 0;
        let totalHabitation_m2 = 0;

        data.features.forEach(feature => {
            const classValue = feature.properties.Classvalue;
            const surface_m2 = feature.properties.Superficie; 

            if (typeof surface_m2 === 'number' && !isNaN(surface_m2)) {
                switch (classValue) {
                    case 1: totalAcadjas_m2 += surface_m2; break;
                    case 2: totalEau_m2 += surface_m2; break;
                    case 3: totalJacinthe_m2 += surface_m2; break;
                    case 4: totalHabitation_m2 += surface_m2; break;
                }
            } else {
                console.warn(`Avertissement: La propriété 'Superficie' pour une entité de l'année ${year} n'est pas un nombre valide (m²). Valeur:`, surface_m2);
            }
        });

        const totalAcadjas_km2 = totalAcadjas_m2 / 1000000;
        const totalEau_km2 = totalEau_m2 / 1000000;
        const totalJacinthe_km2 = totalJacinthe_m2 / 1000000;
        const totalHabitation_km2 = totalHabitation_m2 / 1000000;

        document.getElementById('surface-acadjas').textContent = totalAcadjas_km2.toFixed(2);
        document.getElementById('surface-eau').textContent = totalEau_km2.toFixed(2);
        document.getElementById('surface-jacinthe').textContent = totalJacinthe_km2.toFixed(2);
        document.getElementById('surface-habitation').textContent = totalHabitation_km2.toFixed(2);

    } catch (error) {
        console.error(`Erreur lors de la mise à jour des données quantitatives pour ${year}:`, error);
    }
}

// Exécuter l'initialisation au chargement de la page
window.onload = initMap;