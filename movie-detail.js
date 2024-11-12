import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getFirestore, doc, getDoc, collection, query, where, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// Configuración de TMDB
const TMDB_API_KEY = 'c68b3c5edd56efe86a36e35c4dc891fc';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyAmHL0-1uJZgPAhxqDN4zA1uXH-X6YtzY",
    authDomain: "pixelview-30.firebaseapp.com",
    projectId: "pixelview-30",
    storageBucket: "pixelview-30.appspot.com",
    messagingSenderId: "267067796738",
    appId: "1:267067796738:web:cadd6fd09b25f94fb5661b",
    measurementId: "G-4VPZX8PV0N"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Inicializar cliente WebTorrent
const client = new WebTorrent();

// Función para obtener el path del icono SVG
function getIconPath(iconName) {
    const icons = {
        genre: '<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>',
        type: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M12 8v8M8 12h8"/>',
        duration: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
        date: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
        rating: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
        director: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
        cast: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
        original: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>'
    };
    return icons[iconName] || icons.genre;
}

// Function to create video player elements
function createPlayerElements() {
    const playerContainer = document.getElementById('player-container');
    if (!playerContainer) {
        console.error('Player container not found');
        return null;
    }

    // Clear existing content
    playerContainer.innerHTML = `
        <div id="player-overlay" class="player-overlay">
            <div class="loading-spinner"></div>
            <div id="status-info" class="status-info"></div>
            <div id="torrent-stats" class="torrent-stats">
                <span id="download-speed"></span>
                <span id="peers-count"></span>
            </div>
        </div>
        <video id="torrent-video" class="video-player" controls></video>
    `;

    return {
        overlay: document.getElementById('player-overlay'),
        statusInfo: document.getElementById('status-info'),
        downloadSpeed: document.getElementById('download-speed'),
        peersCount: document.getElementById('peers-count'),
        video: document.getElementById('torrent-video')
    };
}

// Función mejorada para inicializar el reproductor de WebTorrent
function initializeTorrentPlayer(magnetUri) {
    const elements = createPlayerElements();
    if (!elements) {
        console.error('Failed to create player elements');
        return;
    }

    const { overlay, statusInfo, downloadSpeed, peersCount, video } = elements;
    
    // Show loading overlay
    overlay.classList.add('visible');
    statusInfo.textContent = 'Conectando al torrent...';

    // Establecer un tiempo límite para la conexión inicial
    const connectionTimeout = setTimeout(() => {
        if (!client.torrents.length) {
            statusInfo.textContent = 'Error: Tiempo de conexión agotado';
            overlay.classList.add('visible');
        }
    }, 30000); // 30 segundos de timeout

    // Destruir cualquier torrent anterior
    if (client.torrents.length > 0) {
        client.torrents.forEach(torrent => torrent.destroy());
    }

    let hasStartedPlaying = false;
    let bufferingTimeout;

    try {
        client.add(magnetUri, function (torrent) {
            clearTimeout(connectionTimeout);
            
            // Encontrar el archivo de video más grande en el torrent
            const file = torrent.files.reduce((largest, file) => {
                const isVideo = /\.(mp4|mkv|webm)$/i.test(file.name);
                return isVideo && (!largest || file.length > largest.length) ? file : largest;
            }, null);

            if (!file) {
                statusInfo.textContent = 'No se encontró archivo de video en el torrent';
                return;
            }

            // Stream del archivo al reproductor de video
            file.renderTo('#torrent-video');

            // Configurar el buffer inicial
            const INITIAL_BUFFER_SIZE = 5 * 1024 * 1024; // 5MB de buffer inicial
            let initialBuffering = true;

            // Actualizar estadísticas cada segundo
            const statsInterval = setInterval(() => {
                if (!torrent.client) {
                    clearInterval(statsInterval);
                    return;
                }
                
                downloadSpeed.textContent = `↓ ${formatBytes(torrent.downloadSpeed)}/s`;
                peersCount.textContent = `👥 ${torrent.numPeers} peers`;
                
                if (initialBuffering && torrent.downloaded >= INITIAL_BUFFER_SIZE) {
                    initialBuffering = false;
                    video.play().catch(console.error);
                }
                
                if (torrent.numPeers === 0 && !hasStartedPlaying) {
                    statusInfo.textContent = 'Buscando peers... Por favor espera.';
                }
            }, 1000);

            // Video event handlers
            video.addEventListener('playing', () => {
                hasStartedPlaying = true;
                overlay.classList.remove('visible');
                clearTimeout(bufferingTimeout);
            });

            video.addEventListener('waiting', () => {
                overlay.classList.add('visible');
                statusInfo.textContent = 'Buffering...';
                
                clearTimeout(bufferingTimeout);
                bufferingTimeout = setTimeout(() => {
                    if (torrent.numPeers === 0) {
                        statusInfo.textContent = 'No hay peers disponibles. Reintentando...';
                        torrent.resume();
                    }
                }, 10000);
            });

            video.addEventListener('error', (e) => {
                console.error('Video error:', e);
                statusInfo.textContent = `Error en la reproducción: ${e.target.error.message}`;
                overlay.classList.add('visible');
            });

            // Torrent event handlers
            torrent.on('error', function (err) {
                console.error('Error en el torrent:', err);
                statusInfo.textContent = 'Error: ' + err.message;
                overlay.classList.add('visible');
            });

            torrent.on('done', function () {
                console.log('Descarga del torrent completa');
                downloadSpeed.textContent = '✓ Descarga completa';
                clearTimeout(bufferingTimeout);
            });

            torrent.on('close', function () {
                clearInterval(statsInterval);
                clearTimeout(bufferingTimeout);
                video.src = '';
            });

            // Check download speed periodically
            const speedCheckInterval = setInterval(() => {
                if (torrent.downloadSpeed === 0 && hasStartedPlaying) {
                    torrent.resume();
                }
                
                if (!torrent.client) {
                    clearInterval(speedCheckInterval);
                }
            }, 5000);
        });
    } catch (error) {
        console.error('Error al inicializar el torrent:', error);
        statusInfo.textContent = 'Error al inicializar el torrent';
        overlay.classList.add('visible');
        clearTimeout(connectionTimeout);
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Función para crear un elemento de metadato
function createMetadataItem(label, value, iconName) {
    return `
        <div class="metadata-item">
            <svg class="metadata-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                ${getIconPath(iconName)}
            </svg>
            <span class="metadata-label">${label}</span>
            <span class="metadata-value">${value}</span>
        </div>
    `;
}

// Funciones TMDB
async function searchMovie(originalTitle) {
    try {
        const response = await fetch(
            `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(originalTitle)}&language=es-ES`
        );
        
        if (!response.ok) {
            throw new Error('TMDB API request failed');
        }
        
        const data = await response.json();
        const exactMatch = data.results.find(
            movie => movie.original_title.toLowerCase() === originalTitle.toLowerCase()
        );
        
        return exactMatch || data.results[0];
    } catch (error) {
        console.error('Error searching TMDB:', error);
        return null;
    }
}

async function getMovieDetails(movieId) {
    try {
        const response = await fetch(
            `${TMDB_BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&append_to_response=credits&language=es-ES`
        );
        
        if (!response.ok) {
            throw new Error('TMDB API request failed');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error getting movie details:', error);
        return null;
    }
}

function getPosterUrl(posterPath, size = 'w500') {
    if (!posterPath) return null;
    return `https://image.tmdb.org/t/p/${size}${posterPath}`;
}

async function getMoviePoster(originalTitle) {
    try {
        const movie = await searchMovie(originalTitle);
        if (movie && movie.poster_path) {
            return {
                posterUrl: getPosterUrl(movie.poster_path),
                movieId: movie.id
            };
        }
        return { posterUrl: null, movieId: null };
    } catch (error) {
        console.error('Error getting movie poster:', error);
        return { posterUrl: null, movieId: null };
    }
}

// Función principal para cargar los detalles de la película
async function loadMovieDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const movieId = urlParams.get('id');
    
    if (!movieId) {
        window.location.href = 'index.html';
        return;
    }

    try {
        const movieDoc = await getDoc(doc(db, "videos", movieId));
        
        if (!movieDoc.exists()) {
            window.location.href = 'index.html';
            return;
        }

        const movieData = movieDoc.data();
        
        // Actualizar título
        document.getElementById('movieTitle').textContent = movieData.title;
        
        // Inicializar reproductor WebTorrent si hay videoUrl
        if (movieData.videoUrl && typeof movieData.videoUrl === 'string') {
            // Extraer magnet URI del videoUrl
            const magnetUri = movieData.videoUrl.trim();
            if (magnetUri.startsWith('magnet:')) {
                initializeTorrentPlayer(magnetUri);
            } else {
                console.error('URL de video inválida:', magnetUri);
                showError('Formato de video no soportado');
            }
        } else {
            const videoContainer = document.querySelector('.video-container');
            if (videoContainer) {
                videoContainer.innerHTML = '<p>Video no disponible</p>';
            }
        }
        
        // Buscar información de TMDB
        const { posterUrl, movieId: tmdbId } = await getMoviePoster(movieData.originalTitle || movieData.title);
        
        // Actualizar póster
        const posterImage = document.getElementById('moviePoster');
        if (posterImage) {
            posterImage.src = posterUrl || '/assets/placeholder.jpg';
            posterImage.onerror = () => {
                posterImage.src = '/assets/placeholder.jpg';
            };
        }

        // Obtener detalles adicionales de TMDB
        if (tmdbId) {
            const tmdbDetails = await getMovieDetails(tmdbId);
            if (tmdbDetails) {
                const director = tmdbDetails.credits.crew.find(person => person.job === "Director");
                const mainCast = tmdbDetails.credits.cast.slice(0, 3).map(actor => actor.name).join(', ');
                
                // Actualizar metadatos
                const metadataContainer = document.querySelector('.movie-metadata');
                if (metadataContainer) {
                    metadataContainer.innerHTML = `
                        <div class="metadata-section">
                            <h3>Información General</h3>
                            ${createMetadataItem('Género', movieData.genere || 'No especificado', 'genre')}  ${movieData.duration ? createMetadataItem('Duración', movieData.duration, 'duration') : ''}
                            ${createMetadataItem('Estreno', new Date(tmdbDetails.release_date).toLocaleDateString('es-ES'), 'date')}
                            ${createMetadataItem('Calificación', `${tmdbDetails.vote_average.toFixed(1)}/10`, 'rating')}
                        </div>
                        <div class="metadata-section">
                            <h3>Equipo y Reparto</h3>
                            ${director ? createMetadataItem('Director', director.name, 'director') : ''}
                            ${createMetadataItem('Reparto', mainCast, 'cast')}
                        </div>
                        <div class="metadata-section">
                            <h3>Detalles Adicionales</h3>
                            ${createMetadataItem('Título original', tmdbDetails.original_title, 'original')}
                        </div>
                    `;
                }
                
                // Actualizar sinopsis
                const descriptionElement = document.getElementById('movieDescription');
                if (descriptionElement) {
                    descriptionElement.innerHTML = `
                        <h3>Sinopsis</h3>
                        <p>${tmdbDetails.overview || movieData.description || 'No hay sinopsis disponible.'}</p>
                    `;
                }
            }
        }

        // Cargar películas recomendadas
        await loadRecommendedMovies(movieData.genere, movieId);
    } catch (error) {
        console.error("Error al cargar los detalles de la película:", error);
        showError("Ha ocurrido un error al cargar los detalles. Por favor, intenta de nuevo.");
    }
}

async function loadRecommendedMovies(genre, currentMovieId) {
    try {
        const q = query(
            collection(db, "videos"),
            where("genere", "==", genre),
            limit(6)
        );
        
        const querySnapshot = await getDocs(q);
        const recommendedContainer = document.querySelector('.recommended-grid');
        
        if (recommendedContainer) {
            recommendedContainer.innerHTML = '';
            
            for (const doc of querySnapshot.docs) {
                if (doc.id !== currentMovieId) {
                    const movieData = doc.data();
                    const { posterUrl } = await getMoviePoster(movieData.originalTitle || movieData.title);
                    
                    const card = document.createElement('div');
                    card.className = 'movie-card';
                    
                    card.innerHTML = `
                        <div class="image-container">
                            <div class="loading-overlay">
                                <div class="loading-spinner"></div>
                            </div>
                            <img src="${posterUrl || '/assets/placeholder.jpg'}" 
                                 alt="${movieData.title}"
                                 loading="lazy">
                        </div>
                        <div class="movie-info">
                            <h3>${movieData.title}</h3>
                        </div>
                    `;

                    const img = card.querySelector('img');
                    const loadingOverlay = card.querySelector('.loading-overlay');

                    img.onload = () => loadingOverlay.remove();
                    img.onerror = () => {
                        img.src = '/assets/placeholder.jpg';
                        loadingOverlay.remove();
                    };
                    
                    card.addEventListener('click', () => {
                        window.location.href = `movie.html?id=${doc.id}`;
                    });
                    
                    recommendedContainer.appendChild(card);
                }
            }

            const recommendedSection = document.querySelector('.recommended-movies');
            if (recommendedSection) {
                recommendedSection.style.display = 
                    recommendedContainer.children.length > 0 ? 'block' : 'none';
            }
        }
    } catch (error) {
        console.error("Error al cargar películas recomendadas:", error);
    }
}

function showError(message) {
    const container = document.querySelector('.container') || document.body;
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        <p>${message}</p>
        <button onclick="location.reload()">Reintentar</button>
    `;
    container.insertBefore(errorDiv, container.firstChild);
}

// Event listener para cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', loadMovieDetails);

// Event listener para limpiar los torrents cuando se cierra la página
window.addEventListener('beforeunload', () => {
    if (client && client.torrents.length > 0) {
        client.torrents.forEach(torrent => torrent.destroy());
    }
});