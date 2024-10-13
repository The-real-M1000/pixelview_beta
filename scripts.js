// API key for DoodStream
const API_KEY = '449386ekfnkwg9s3xe5nhz';
const API_BASE_URL = 'https://doodapi.com/api';

// Variables for pagination and sorting
let currentPage = 1;
const pageSize = 20;
let currentGenre = 'all';
let currentSortMethod = 'date';

// DOM References
let videoList;
let genereButtons;
let searchInput;
let searchButton;
let loadMoreButton;
let sortAlphabeticallyButton;
let sortByDateButton;

// Function to initialize DOM elements
function initializeElements() {
    videoList = document.getElementById('videoList');
    genereButtons = document.getElementById('genereButtons');
    searchInput = document.getElementById('search-bar');
    searchButton = document.getElementById('search-button');
    loadMoreButton = document.getElementById('loadMoreButton');
    sortAlphabeticallyButton = document.querySelector('.sort-buttons button:first-child');
    sortByDateButton = document.querySelector('.sort-buttons button:last-child');

    if (!videoList) console.error("Element 'videoList' not found");
    if (!genereButtons) console.error("Element 'genereButtons' not found");
    if (!searchInput) console.error("Element 'searchInput' not found");
    if (!searchButton) console.error("Element 'searchButton' not found");
    if (!loadMoreButton) console.error("Element 'loadMoreButton' not found");
    if (!sortAlphabeticallyButton) console.error("Element 'sortAlphabetically' not found");
    if (!sortByDateButton) console.error("Element 'sortByDate' not found");
}

// Function to load videos from DoodStream API
async function loadVideos(isLoadMore = false) {
    console.log("Loading videos - Genre:", currentGenre, "Order:", currentSortMethod);
    if (!videoList) {
        console.error("videoList is not defined");
        return;
    }
    
    if (!isLoadMore) {
        videoList.innerHTML = "";
        currentPage = 1;
    }

    try {
        const url = `${API_BASE_URL}/file/list?key=${API_KEY}&page=${currentPage}&per_page=${pageSize}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.status !== 200 || !data.result || data.result.files.length === 0) {
            console.log("No videos found");
            if (!isLoadMore) {
                videoList.innerHTML = `<p>No videos found for the genre: ${currentGenre}.</p>`;
            }
            loadMoreButton.style.display = 'none';
        } else {
            data.result.files.forEach((file) => {
                const videoContainer = createVideoCard(file);
                videoList.appendChild(videoContainer);
            });
            loadMoreButton.style.display = 'block';
        }
    } catch (error) {
        console.error("Error loading videos:", error);
        videoList.innerHTML += "<p>Error loading videos. Please try again later.</p>";
    }

    lazyLoadImages();
}

// Function to create a video card element
function createVideoCard(videoData) {
    console.log("Creating card for:", videoData.title);
    const videoContainer = document.createElement("div");
    videoContainer.className = 'movie';
    videoContainer.setAttribute('tabindex', '0');
    videoContainer.setAttribute('role', 'button');
    videoContainer.setAttribute('aria-label', `Watch video: ${videoData.title}`);
    
    const safeTitle = sanitizeInput(videoData.title);
    videoContainer.innerHTML = `
        <div class="image-container">
            <img src="placeholder.jpg" data-src="${videoData.splash_img || 'placeholder.jpg'}" alt="${safeTitle}" loading="lazy">
        </div>
        <h2 class="title">${safeTitle}</h2>
        <div class="info">${videoData.length} - ${videoData.uploaded}</div>
    `;
    videoContainer.addEventListener('click', () => {
        window.open(`https://dood.ws/d/${videoData.file_code}`, '_blank');
    });

    return videoContainer;
}

// Function to sanitize user input
function sanitizeInput(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
}

// Function to update the appearance of sort buttons
function updateSortButtons() {
    if (sortAlphabeticallyButton && sortByDateButton) {
        sortAlphabeticallyButton.classList.toggle('active', currentSortMethod === 'alphabetical');
        sortByDateButton.classList.toggle('active', currentSortMethod === 'date');
    }
}

// Set up event listeners
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

// Function to set up genre and sort buttons
function setupGenreAndSortButtons() {
    if (genereButtons) {
        const genreButtons = genereButtons.querySelectorAll('button:not(.sort-buttons button)');
        genreButtons.forEach(button => {
            button.addEventListener('click', () => {
                let selectedGenre = button.textContent;
                console.log("Selected genre (original):", selectedGenre);
                
                if (selectedGenre.toLowerCase() === 'todos') {
                    currentGenre = 'all';
                } else {
                    currentGenre = selectedGenre.toLowerCase();
                }
                
                console.log("Normalized genre:", currentGenre);
                currentPage = 1; // Reset pagination
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
            currentPage = 1; // Reset pagination
            loadVideos();
        });

        sortByDateButton.addEventListener('click', () => {
            currentSortMethod = 'date';
            updateSortButtons();
            currentPage = 1; // Reset pagination
            loadVideos();
        });
    }
}

// Function to perform search
async function performSearch() {
    if (!searchInput || !videoList) {
        console.error("Search elements not found");
        return;
    }

    const searchQuery = searchInput.value.toLowerCase();
    videoList.innerHTML = "";
    currentPage = 1; // Reset pagination

    try {
        const url = `${API_BASE_URL}/search/videos?key=${API_KEY}&search_term=${encodeURIComponent(searchQuery)}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.status !== 200 || !data.result || data.result.length === 0) {
            videoList.innerHTML = "<p>No results found for the search.</p>";
        } else {
            data.result.forEach((videoData) => {
                const videoContainer = createVideoCard(videoData);
                videoList.appendChild(videoContainer);
            });
        }
        loadMoreButton.style.display = 'none'; // Hide button for searches
    } catch (error) {
        console.error("Error performing search:", error);
        videoList.innerHTML = "<p>Error performing search. Please try again later.</p>";
    }
}

// Function to implement lazy loading of images
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

// Main initialization
document.addEventListener('DOMContentLoaded', (event) => {
    console.log("DOM fully loaded and parsed");
    initializeElements();
    setupEventListeners();
    updateSortButtons(); // Update sort buttons on start
    loadVideos();

    // Add ripple effect to all buttons
    const buttons = document.getElementsByTagName("button");
    for (const button of buttons) {
        button.addEventListener("click", createRipple);
    }
});

// Function to create ripple effect on buttons
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
