// Variables globales
let videoList;
let genereButtons;
let searchInput;
let searchButton;
let loadMoreButton;
let sortAlphabeticallyButton;
let sortByDateButton;

// Variables para la paginación y ordenación
const pageSize = 20;
let currentGenre = 'all';
let currentSortMethod = 'date';
let currentPage = 1;

// Configuración de la API
const apiKey = "https://dood.li/e/eqfz49mnny89";
const apiBaseUrl = "https://api.vidhide.com";

// Función para inicializar elementos del DOM
function initializeElements() {
    videoList = document.getElementById('videoList');
    genereButtons = document.getElementById('genereButtons');
    searchInput = document.getElementById('search-bar');
    searchButton = document.getElementById('search-button');
    loadMoreButton = document.getElementById('loadMoreButton');
    sortAlphabeticallyButton = document.querySelector('.sort-buttons button:first-child');
    sortByDateButton = document.querySelector('.sort-buttons button:last-child');

    if (!videoList) console.error("Elemento 'videoList' no encontrado");
    if (!genereButtons) console.error("Elemento 'genereButtons' no encontrado");
    if (!searchInput) console.error("Elemento 'searchInput' no encontrado");
    if (!searchButton) console.error("Elemento 'searchButton' no encontrado");
    if (!loadMoreButton) console.error("Elemento 'loadMoreButton' no encontrado");
    if (!sortAlphabeticallyButton) console.error("Elemento 'sortAlphabetically' no encontrado");
    if (!sortByDateButton) console.error("Elemento 'sortByDate' no encontrado");
}

// Función para cargar y mostrar videos desde la API de VidHide
async function loadVideos(isLoadMore = false) {
    console.log("Cargando videos - Género:", currentGenre, "Orden:", currentSortMethod);
    if (!videoList) {
        console.error("videoList no está definido");
        return;
    }
    
    if (!isLoadMore) {
        videoList.innerHTML = "";
        currentPage = 1;
    }

    const apiUrl = `${apiBaseUrl}/videos?api_key=${apiKey}&page=${currentPage}&per_page=${pageSize}&category=${currentGenre}&sort=${currentSortMethod}`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (data.videos.length === 0) {
            console.log("No se encontraron videos");
            if (!isLoadMore) {
                videoList.innerHTML = `<p>No se encontraron videos para el género: ${currentGenre}.</p>`;
            }
            loadMoreButton.style.display = 'none';
        } else {
            data.videos.forEach((video) => {
                const videoContainer = createVideoCard(video);
                videoList.appendChild(videoContainer);
            });
            loadMoreButton.style.display = 'block';
        }
    } catch (error) {
        console.error("Error al cargar videos:", error);
        videoList.innerHTML += "<p>Error al cargar videos. Por favor, intenta de nuevo más tarde.</p>";
    }

    lazyLoadImages();
}

// Función para crear un elemento de tarjeta de video
function createVideoCard(videoData) {
    console.log("Creando tarjeta para:", videoData.title);
    const videoContainer = document.createElement("div");
    videoContainer.className = 'movie';
    videoContainer.setAttribute('tabindex', '0');
    videoContainer.setAttribute('role', 'button');
    videoContainer.setAttribute('aria-label', `Ver video: ${videoData.title}`);
    
    const safeTitle = sanitizeInput(videoData.title);
    videoContainer.innerHTML = `
        <div class="image-container">
            <img src="placeholder.jpg" data-src="${videoData.thumbnail}" alt="${safeTitle}" loading="lazy">
        </div>
        <h2 class="title">${safeTitle}</h2>
        <div class="info">${videoData.duration} - ${videoData.category}</div>
    `;
    videoContainer.addEventListener('click', () => {
        window.open(videoData.embed_url, '_blank');
    });

    return videoContainer;
}

// Función para sanear la entrada del usuario
function sanitizeInput(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
}

// Función para actualizar la apariencia de los botones de ordenación
function updateSortButtons() {
    if (sortAlphabeticallyButton && sortByDateButton) {
        sortAlphabeticallyButton.classList.toggle('active', currentSortMethod === 'alphabetical');
        sortByDateButton.classList.toggle('active', currentSortMethod === 'date');
    }
}

// Configurar event listeners
function setupEventListeners() {
    if (searchButton) {
        searchButton.addEventListener("click", performSearch);
    }
    if (searchInput) {
        searchInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                performSearch();
            }
        });
    }
    if (loadMoreButton) {
        loadMoreButton.addEventListener('click', () => {
            currentPage++;
            loadVideos(true);
        });
    }
    setupGenreAndSortButtons();
}

// Función para configurar los botones de género y ordenación
function setupGenreAndSortButtons() {
    if (genereButtons) {
        const genreButtons = genereButtons.querySelectorAll('button:not(.sort-buttons button)');
        genreButtons.forEach(button => {
            button.addEventListener('click', () => {
                let selectedGenre = button.textContent.toLowerCase();
                currentGenre = selectedGenre === 'todos' ? 'all' : selectedGenre;
                console.log("Género seleccionado:", currentGenre);
                currentPage = 1;
                loadVideos();

                genreButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
            });
        });
    }

    if (sortAlphabeticallyButton && sortByDateButton) {
        sortAlphabeticallyButton.addEventListener('click', () => {
            currentSortMethod = 'alphabetical';
            updateSortButtons();
            currentPage = 1;
            loadVideos();
        });

        sortByDateButton.addEventListener('click', () => {
            currentSortMethod = 'date';
            updateSortButtons();
            currentPage = 1;
            loadVideos();
        });
    }
}

// Función para buscar videos
async function performSearch() {
    if (!searchInput || !videoList) {
        console.error("Elementos de búsqueda no encontrados");
        return;
    }

    const searchQuery = searchInput.value;
    videoList.innerHTML = "";
    currentPage = 1;

    const apiUrl = `${apiBaseUrl}/search?api_key=${apiKey}&query=${encodeURIComponent(searchQuery)}&page=${currentPage}&per_page=${pageSize}`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (data.videos.length === 0) {
            videoList.innerHTML = "<p>No se encontraron resultados para la búsqueda.</p>";
            loadMoreButton.style.display = 'none';
        } else {
            data.videos.forEach((video) => {
                const videoContainer = createVideoCard(video);
                videoList.appendChild(videoContainer);
            });
            loadMoreButton.style.display = 'block';
        }
    } catch (error) {
        console.error("Error al realizar la búsqueda:", error);
        videoList.innerHTML = "<p>Error al realizar la búsqueda. Por favor, intenta de nuevo más tarde.</p>";
    }
}

// Función para crear el efecto ripple en los botones
function createRipple(event) {
    const button = event.currentTarget;
    const circle = document.createElement("span");
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;

    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - button.offsetLeft - radius}px`;
    circle.style.top = `${event.clientY - button.offsetTop - radius}px`;
    circle.classList.add("ripple");

    const ripple = button.getElementsByClassName("ripple")[0];
    if (ripple) {
        ripple.remove();
    }

    button.appendChild(circle);
}

// Función para implementar lazy loading de imágenes
function lazyLoadImages() {
    const images = document.querySelectorAll('img[data-src]');
    const options = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.onload = () => {
                    img.classList.add('loaded');
                };
                observer.unobserve(img);
            }
        });
    }, options);

    images.forEach(img => observer.observe(img));
}

// Inicialización principal
document.addEventListener('DOMContentLoaded', (event) => {
    console.log("DOM completamente cargado y parseado");
    initializeElements();
    setupEventListeners();
    updateSortButtons();
    loadVideos();

    // Añadir efecto ripple a todos los botones
    const buttons = document.getElementsByTagName("button");
    for (const button of buttons) {
        button.addEventListener("click", createRipple);
    }
});
