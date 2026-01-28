const API_TOKEN = "Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJkMmIwMzY4NTAyYzEwY2YyMDQ4OThiYjg3MTgyYzAxMCIsIm5iZiI6MTc0NDkyNzMyMC4yMzEsInN1YiI6IjY4MDE3YTU4MmU4OTU4ZjBmOTk5NWQ0MSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.I22MMgWKL1X-2czV96nC49I4L3Fj_iKJm8qO_hm2GKk";
const BASE_URL = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p/w500";

let currentCategory = 'action';
let trendingItems = [];

async function fetchTrending(type) {
    try {
        const response = await fetch(`${BASE_URL}/trending/${type}/day`, {
            headers: { Authorization: API_TOKEN }
        });
        const data = await response.json();
        return data.results || [];
    } catch (error) {
        console.error("Error fetching trending:", error);
        return [];
    }
}

async function displayTrending() {
    const type = document.getElementById("typeFilter").value;
    const items = await fetchTrending(type);
    const container = document.getElementById("trendingSlider");

    container.innerHTML = '';

    for (const item of items.slice(0, 10)) {
        const title = item.title || item.name;
        const year = (item.release_date || item.first_air_date || "").slice(0, 4);
        const poster = item.poster_path ? IMG_BASE + item.poster_path : 'https://via.placeholder.com/300x450?text=No+Poster';
        const itemType = type === 'all' ? (item.title ? 'movie' : 'tv') : type;
        const displayType = itemType === 'tv' ? 'TV Show' : 'Movie';

        const bookmarked = await isBookmarked(item.id, itemType);

        const cardElement = document.createElement('div');
        cardElement.className = 'movie-card';

        // Get IMDB rating for trending items
        const imdbID = await getIMDbID(item.id, itemType);
        const imdbRating = await getIMDbRating(imdbID);
        const ratingText = imdbRating ? ` • ${imdbRating}` : ' • No Rating';

        cardElement.innerHTML = `
            <div class="movie-poster-container">
                <img src="${poster}" alt="${title}" class="movie-poster">
                <button class="bookmark-btn ${bookmarked ? 'bookmarked' : ''}" onclick="event.stopPropagation(); toggleBookmark('${item.id}', '${itemType}', '${title.replace(/'/g, "\\'")}', '${poster}', event)">
                    <svg viewBox="0 0 24 24" fill="${bookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                    </svg>
                </button>
            </div>
            <div class="movie-info">
                <h3 class="movie-title">${title}</h3>
                <p class="movie-year">${year} • ${displayType}${ratingText}</p>
                <button onclick="watch('${item.id}', '${itemType}')" class="watch-btn">Watch Now</button>
            </div>
        `;

        cardElement.addEventListener('click', (e) => {
            if (e.target.closest('.bookmark-btn') || e.target.closest('.watch-btn')) {
                return;
            }
            localStorage.setItem(`lastClicked_${item.id}`, Date.now());
            if (itemType === 'tv') {
                window.location.href = `media.html?id=${item.id}&season=1&episode=1`;
            } else {
                window.location.href = `watch.html?id=${item.id}`;
            }
        });

        container.appendChild(cardElement);
    }
}

async function fetchMovies(type, count = 50, year = "", genre = "", searchTerm = "") {
    let movies = [];
    let page = 1;

    while (movies.length < count && page <= 10) {
        let url = "";

        if (searchTerm) {
            // Use pre-encoded search term
            const query = typeof searchTerm === 'string' && searchTerm.includes('%') ? searchTerm : encodeURIComponent(searchTerm);
            url = `${BASE_URL}/search/${type}?query=${query}&page=${page}`;
        } else {
            url = `${BASE_URL}/discover/${type}?sort_by=popularity.desc&page=${page}`;
            if (year) url += `&year=${year}`;
            if (genre) url += `&with_genres=${getGenreId(genre, type)}`;
        }

        try {
            const res = await fetch(url, {
                headers: { Authorization: API_TOKEN }
            });

            if (!res.ok) {
                console.error(`API Error: ${res.status} ${res.statusText}`);
                break;
            }

            const data = await res.json();
            if (!data.results || data.results.length === 0) break;

            // Filter out items without proper titles
            const validResults = data.results.filter(item => 
                item && (item.title || item.name) && item.id
            );

            movies.push(...validResults.slice(0, count - movies.length));
            page++;
        } catch (error) {
            console.error("Error fetching movies:", error);
            break;
        }
    }

    return movies;
}

async function fetchCategoryData(category) {
    showLoading();
    currentCategory = category;
    currentPage = 1; // Reset page counter
    updateActiveCategory(category);
    const type = document.getElementById("typeFilter").value;

    // Remove search indicator when switching to category
    const searchIndicator = document.querySelector('.search-indicator');
    if (searchIndicator) {
        searchIndicator.remove();
    }

    // Show trending section when not searching
    const trendingSection = document.querySelector('.trending-section');
    if (trendingSection && localStorage.getItem('hideTrending') !== 'true') {
        trendingSection.style.display = 'block';
    }

    try {
        const items = await fetchMovies(type, 50, "", category);
        displayMovies(items, type);
        await displayTrending();
    } catch (err) {
        console.error("Category error:", err);
        document.getElementById('movies').innerHTML = "<p>Could not load content. This may be network related issues.</p>";
    }

    hideLoading();
}

async function fetchData() {
    showLoading();
    currentPage = 1; // Reset page counter

    const type = document.getElementById("typeFilter").value;
    const year = document.getElementById("yearFilter").value;
    const genre = document.getElementById("genreFilter").value;

    // Remove search indicator when using filters
    const searchIndicator = document.querySelector('.search-indicator');
    if (searchIndicator) {
        searchIndicator.remove();
    }

    // Show trending section when using filters (not searching)
    const trendingSection = document.querySelector('.trending-section');
    if (trendingSection && localStorage.getItem('hideTrending') !== 'true') {
        trendingSection.style.display = 'block';
    }

    try {
        const movies = await fetchMovies(type, 50, year, genre);
        displayMovies(movies, type);
        await displayTrending();
    } catch (err) {
        console.error("Fetch error:", err);
        document.getElementById('movies').innerHTML = "<p>Could not load content.</p>";
    }

    hideLoading();
}

let searchTimeout;

async function searchMovies() {
    const term = document.getElementById("searchInput").value.trim();
    if (!term || term.length < 2) {
        return;
    }

    // Show search results UI and close search bar
    showSearchResults();
    closeSearch();

    // Clear previous timeout
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }

    // Show loading state
    showSearchLoading();

    // Debounce search to prevent too many API calls
    searchTimeout = setTimeout(async () => {
        try {
            // Search without any filters - ignore all filter settings during search
            const encodedTerm = encodeURIComponent(term);

            // Search both movies and TV shows concurrently for better performance
            const [movieResults, tvResults] = await Promise.all([
                fetchMovies("movie", 50, "", "", encodedTerm),
                fetchMovies("tv", 50, "", "", encodedTerm)
            ]);
            const searchResults = [...movieResults, ...tvResults];

            // Enhanced relevance scoring for better search results
            const normalizedTerm = term.toLowerCase().trim();
            const searchWords = normalizedTerm.split(' ').filter(word => word.length > 0);

            const combinedResults = searchResults
                .filter(item => item && (item.title || item.name))
                .map(item => {
                    const title = (item.title || item.name || '').toLowerCase();
                    const overview = (item.overview || '').toLowerCase();
                    let relevanceScore = 0;

                    // Exact title match gets highest score
                    if (title === normalizedTerm) {
                        relevanceScore = 10000;
                    }
                    // Title starts with search term
                    else if (title.startsWith(normalizedTerm)) {
                        relevanceScore = 9000;
                    }
                    // Title contains exact search term as whole words
                    else if (new RegExp(`\\b${normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(title)) {
                        relevanceScore = 8000;
                    }
                    // Title contains exact search term anywhere
                    else if (title.includes(normalizedTerm)) {
                        relevanceScore = 7000;
                    }
                    // Check if title contains all search words
                    else if (searchWords.length > 1) {
                        const wordsFound = searchWords.filter(word => title.includes(word));
                        if (wordsFound.length === searchWords.length) {
                            relevanceScore = 6000;
                        } else if (wordsFound.length > 0) {
                            relevanceScore = (wordsFound.length / searchWords.length) * 4000;
                        }
                    }
                    // Single word partial matches
                    else if (searchWords.length === 1) {
                        const word = searchWords[0];
                        if (word.length > 2 && title.includes(word)) {
                            relevanceScore = 5000;
                        }
                    }

                    // Only add overview bonuses if we already have some relevance from title
                    if (relevanceScore > 0) {
                        // Boost for overview matches
                        if (overview.includes(normalizedTerm)) {
                            relevanceScore += 500;
                        }

                        // Check for partial matches in overview
                        searchWords.forEach(word => {
                            if (word.length > 2 && overview.includes(word)) {
                                relevanceScore += 100;
                            }
                        });

                        // Small popularity boost to break ties (only for relevant results)
                        relevanceScore += Math.min((item.popularity || 0) * 0.1, 50);
                    }

                    return { ...item, relevanceScore };
                })
                .filter(item => item.relevanceScore > 0) // Only show items with relevance
                .sort((a, b) => {
                    // Sort purely by relevance score (highest first)
                    return b.relevanceScore - a.relevanceScore;
                });

            // Show only the most relevant results - up to 50 items with good relevance scores
            const finalResults = combinedResults
                .filter(item => item.relevanceScore >= 1000) // Only show highly relevant results
                .slice(0, 50);

            hideSearchLoading();

            if (finalResults.length === 0) {
                showSearchEmpty();
            } else {
                await displaySearchResults(finalResults, term, combinedResults.length);
            }
        } catch (err) {
            console.error("Search error:", err);
            hideSearchLoading();
            showSearchEmpty("Search Error", "Please try again later");
        }
    }, 300); // Reduced debounce for faster search
}

function showSearchResults() {
    const overlay = document.getElementById('searchResultsOverlay');
    const container = document.getElementById('searchResultsContainer');

    overlay.classList.add('active');
    container.classList.add('active');
}

function closeSearchResults() {
    const overlay = document.getElementById('searchResultsOverlay');
    const container = document.getElementById('searchResultsContainer');

    overlay.classList.remove('active');
    container.classList.remove('active');

    // Clear search input
    document.getElementById('searchInput').value = '';

    // Clear results
    document.getElementById('searchResultsGrid').innerHTML = '';
    document.getElementById('searchResultsStats').style.display = 'none';
    document.getElementById('searchResultsEmpty').style.display = 'none';
}

function showSearchLoading() {
    document.getElementById('searchLoading').style.display = 'flex';
    document.getElementById('searchResultsGrid').innerHTML = '';
    document.getElementById('searchResultsStats').style.display = 'none';
    document.getElementById('searchResultsEmpty').style.display = 'none';
}

function hideSearchLoading() {
    document.getElementById('searchLoading').style.display = 'none';
}

function showSearchEmpty(title = "No Results Found", message = "Try different keywords or check your spelling") {
    const emptyDiv = document.getElementById('searchResultsEmpty');
    emptyDiv.querySelector('h3').textContent = title;
    emptyDiv.querySelector('p').textContent = message;
    emptyDiv.style.display = 'flex';
    document.getElementById('searchResultsStats').style.display = 'none';
}

async function displaySearchResults(items, searchTerm, totalFound) {
    const container = document.getElementById("searchResultsGrid");
    const statsDiv = document.getElementById("searchResultsStats");
    const titleDiv = document.getElementById("searchResultsTitle");

    // Update title and stats
    titleDiv.textContent = `Search: "${searchTerm}"`;
    statsDiv.textContent = `Found ${items.length} most relevant results of ${totalFound} total matches`;
    statsDiv.style.display = 'block';

    container.innerHTML = "";

    if (!items.length) {
        showSearchEmpty();
        return;
    }

    for (const item of items) {
        const title = item.title || item.name;
        const year = (item.release_date || item.first_air_date || "").slice(0, 4);
        const poster = item.poster_path ? IMG_BASE + item.poster_path : 'https://via.placeholder.com/300x450?text=No+Poster';
        const itemType = item.title ? 'movie' : 'tv';

        const imdbID = await getIMDbID(item.id, itemType);
        const bookmarked = await isBookmarked(item.id, itemType);

        // Get IMDB rating
        const imdbRating = await getIMDbRating(imdbID);

        const card = document.createElement("div");
        card.className = "movie-card";
        card.style.position = "relative";

        const displayType = itemType === 'tv' ? 'TV Show' : 'Movie';
        const ratingText = imdbRating ? ` • ${imdbRating}` : ' • No Rating';

        card.innerHTML = `
            <div class="movie-poster-container">
                <img src="${poster}" alt="${title}" class="movie-poster">
                <button class="bookmark-btn ${bookmarked ? 'bookmarked' : ''}" onclick="event.stopPropagation(); toggleBookmark('${item.id}', '${itemType}', '${title.replace(/'/g, "\\'")}', '${poster}', event)">
                    <svg viewBox="0 0 24 24" fill="${bookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                    </svg>
                </button>
            </div>
            <div class="movie-info">
                <h3 class="movie-title">${title}</h3>
                <p class="movie-year">${year} • ${displayType}${ratingText}</p>
                <button onclick="watch('${item.id}', '${itemType}')" class="watch-btn">Watch Now</button>
            </div>
        `;

        // Add click event to close search and navigate
        card.addEventListener('click', (e) => {
            if (e.target.closest('.bookmark-btn') || e.target.closest('.watch-btn')) {
                return; // Don't close if clicking bookmark or watch button
            }

            closeSearchResults();
            localStorage.setItem(`lastClicked_${item.id}`, Date.now());
            if (itemType === 'tv') {
                window.location.href = `media.html?id=${item.id}&season=1&episode=1`;
            } else {
                window.location.href = `watch.html?id=${item.id}`;
            }
        });

        container.appendChild(card);
    }
}

function updateActiveCategory(category) {
    document.querySelectorAll('.genre-btn, .category-btn').forEach(btn => {
        btn.classList.remove("active");
        const btnGenre = btn.dataset.genre || btn.textContent.toLowerCase().trim();
        if (btnGenre === category.toLowerCase()) {
            btn.classList.add("active");
        }
    });
}

async function displayMovies(items, type) {
    const container = document.getElementById("movies");
    container.innerHTML = "";

    if (!items.length) {
        container.innerHTML = "<p>No content found.</p>";
        return;
    }

    // Process items in batches for better performance
    const batchSize = 10;
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);

        // Process batch concurrently
        await Promise.all(batch.map(async (item) => {
            const title = item.title || item.name;
            const year = (item.release_date || item.first_air_date || "").slice(0, 4);
            const poster = item.poster_path ? IMG_BASE + item.poster_path : 'https://via.placeholder.com/300x450?text=No+Poster';
            const itemType = type === 'all' ? (item.title ? 'movie' : 'tv') : type;

            // Use Promise.all for concurrent operations
            const [imdbID, bookmarked] = await Promise.all([
                getIMDbID(item.id, type),
                isBookmarked(item.id, itemType)
            ]);

            // Get IMDB rating with timeout for faster loading
            const imdbRating = await Promise.race([
                getIMDbRating(imdbID),
                new Promise(resolve => setTimeout(() => resolve(null), 2000))
            ]);

        const card = document.createElement("div");
            card.className = "movie-card";
            card.style.position = "relative";

            const displayType = itemType === 'tv' ? 'TV Show' : 'Movie';
            const ratingText = imdbRating ? ` • ${imdbRating}` : ' • No Rating';

            card.innerHTML = `
                <div class="movie-poster-container">
                    <img src="${poster}" alt="${title}" class="movie-poster" loading="lazy">
                    <button class="bookmark-btn ${bookmarked ? 'bookmarked' : ''}" onclick="event.stopPropagation(); toggleBookmark('${item.id}', '${itemType}', '${title.replace(/'/g, "\\'")}', '${poster}', event)">
                        <svg viewBox="0 0 24 24" fill="${bookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                        </svg>
                    </button>
                </div>
                <div class="movie-info">
                    <h3 class="movie-title">${title}</h3>
                    <p class="movie-year">${year} • ${displayType || '?'}${ratingText}</p>
                    <button onclick="watch('${item.id}', '${itemType}')" class="watch-btn">Watch Now</button>
                </div>
            `;
            container.appendChild(card);
        }));

        // Small delay between batches to prevent UI blocking
        if (i + batchSize < items.length) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }
}

function displayWatchLaterSection() {
    // Remove existing watch later section
    const existingSection = document.querySelector('.watch-later-section');
    if (existingSection) {
        existingSection.remove();
    }

    const watchLater = JSON.parse(localStorage.getItem('watchLater')) || [];

    if (watchLater.length > 0) {
        const container = document.createElement('div');
        container.className = 'watch-later-section';
        container.innerHTML = '<h2>Watch Later</h2><div class="watch-later-items"></div>';

        const announcementSection = document.getElementById('announcementSection');
        const homeSection = document.getElementById('homeSection');
        if (announcementSection && announcementSection.parentNode) {
            announcementSection.parentNode.insertBefore(container, announcementSection.nextSibling);
        } else if (homeSection) {
            homeSection.appendChild(container);
        }

        const itemsContainer = container.querySelector('.watch-later-items');
        itemsContainer.className = 'resume-items'; // Reuse resume items styling

        // Sort by most recent first
        watchLater.sort((a, b) => b.timestamp - a.timestamp);

        watchLater.forEach(item => {
            const watchLaterCard = document.createElement('div');
            watchLaterCard.className = 'resume-card';

            watchLaterCard.innerHTML = `
                <div class="poster-container">
                    <img src="${item.poster}" alt="${item.title}" class="movie-poster">
                    <div class="play-overlay">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                            <path d="M6 4v16l12-8z"/>
                        </svg>
                    </div>
                </div>
                <button onclick="event.stopPropagation(); removeFromWatchLater('${item.id}', '${item.type}')" class="bookmark-btn bookmarked" style="top: 8px; right: 8px;">
                    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                    </svg>
                </button>
                <div class="movie-info">
                    <h3 class="movie-title">${item.title}</h3>
                    <div class="episode-info">
                        <span class="episode-season">${item.type === 'tv' ? 'TV Show' : 'Movie'}</span>
                        <span class="time-remaining">Saved</span>
                    </div>
                </div>
            `;

            // Add click event listener
            watchLaterCard.addEventListener('click', () => {
                // Update click timestamp for recent tracking
                localStorage.setItem(`lastClicked_${item.id}`, Date.now());

                if (item.type === 'tv') {
                    // Check for last watched episode or use defaults
                    const lastWatched = JSON.parse(localStorage.getItem(`lastWatched-${item.id}`));
                    const season = lastWatched?.season || 1;
                    const episode = lastWatched?.episodeId || 1;
                    window.location.href = `media.html?id=${item.id}&season=${season}&episode=${episode}`;
                } else {
                    window.location.href = `watch.html?id=${item.id}`;
                }
            });
            itemsContainer.appendChild(watchLaterCard);
        });
    }

    checkEmptyState();
}

function removeFromWatchLater(id, type) {
    const watchLater = JSON.parse(localStorage.getItem('watchLater')) || [];
    const filtered = watchLater.filter(item => !(item.id === id && item.type === type));
    localStorage.setItem('watchLater', JSON.stringify(filtered));
    displayWatchLaterSection();
}

function checkEmptyState() {
    const resumeSection = document.querySelector('.resume-section');
    const watchLaterSection = document.querySelector('.watch-later-section');
    const emptyState = document.getElementById('homeEmptyState');

    if (!resumeSection && !watchLaterSection) {
        emptyState.style.display = 'block';
    } else {
        emptyState.style.display = 'none';
    }
}

function openStreamSettings(imdbId) {
    window.location.href = `stream.html?imdb=${imdbId}&type=tv`;
}

async function watch(id, type, season = 1, episode = 1) {
    try {
        const imdbID = await getIMDbID(id, type);
        const now = Date.now();
        localStorage.setItem(`lastClicked_${imdbID}`, now);

        if (type === "tv") {
            // Get last watched episode or use defaults
            const lastWatched = JSON.parse(localStorage.getItem(`lastWatched-${imdbID}`));
            const watchedSeason = lastWatched?.season || season;
            const watchedEpisode = lastWatched?.episodeId || episode;

            // Save minimal progress data with proper timestamps and high priority
            const existingProgress = JSON.parse(localStorage.getItem(`watchProgress_${imdbID}`)) || {};
            const progressData = {
                currentTime: existingProgress.currentTime || 0,
                duration: existingProgress.duration || 2700,
                title: await getMediaTitle(imdbID, type),
                poster: await getMediaPoster(imdbID, type),
                type: type,
                season: watchedSeason,
                episode: watchedEpisode,
                lastUpdated: now,
                priority: now + 2000 // High priority for new clicks
            };
            localStorage.setItem(`watchProgress_${imdbID}`, JSON.stringify(progressData));

            window.location.href = `media.html?id=${imdbID}&season=${watchedSeason}&episode=${watchedEpisode}`;
        } else {
            const existingProgress = JSON.parse(localStorage.getItem(`watchProgress_${imdbID}`)) || {};
            const progressData = {
                currentTime: existingProgress.currentTime || 0,
                duration: existingProgress.duration || 6300,
                title: await getMediaTitle(imdbID, type),
                poster: await getMediaPoster(imdbID, type),
                type: type,
                lastUpdated: now,
                priority: now + 2000 // High priority for new clicks
            };
            localStorage.setItem(`watchProgress_${imdbID}`, JSON.stringify(progressData));

            window.location.href = `watch.html?id=${imdbID}`;
        }
    } catch (err) {
        console.error("Error getting IMDB ID:", err);
        const now = Date.now();
        localStorage.setItem(`lastClicked_${id}`, now);

        // Create basic progress entry even on error
        const progressData = {
            currentTime: 5,
            duration: type === 'tv' ? 2700 : 6300,
            title: 'Unknown Title',
            poster: 'https://via.placeholder.com/300x450?text=No+Poster',
            type: type,
            lastUpdated: now,
            priority: now + 2000
        };
        
        if (type === "tv") {
            const lastWatched = JSON.parse(localStorage.getItem(`lastWatched-${id}`));
            const watchedSeason = lastWatched?.season || season;
            const watchedEpisode = lastWatched?.episodeId || episode;
            progressData.season = watchedSeason;
            progressData.episode = watchedEpisode;
            localStorage.setItem(`watchProgress_${id}`, JSON.stringify(progressData));
            window.location.href = `media.html?id=${id}&season=${watchedSeason}&episode=${watchedEpisode}`;
        } else {
            localStorage.setItem(`watchProgress_${id}`, JSON.stringify(progressData));
            window.location.href = `watch.html?id=${id}`;
        }
    }
}

// Bookmark functionality
async function toggleBookmark(id, type, title, poster, event) {
    event.stopPropagation();
    event.preventDefault();

    const bookmarks = JSON.parse(localStorage.getItem('watchLater')) || [];

    // Find the button element - handle both direct click and child click
    let bookmarkBtn = event.target;
    if (!bookmarkBtn.classList.contains('bookmark-btn')) {
        bookmarkBtn = event.target.closest('.bookmark-btn');
    }
    if (!bookmarkBtn) {
        bookmarkBtn = event.currentTarget;
    }

    // Check for existing bookmark with both original ID and potential IMDB ID
    let existingIndex = bookmarks.findIndex(item => item.id === id && item.type === type);

    // Also check for IMDB ID version if this is a TMDB ID
    let imdbID = null;
    if (existingIndex === -1 && (type === 'movie' || type === 'tv')) {
        try {
            imdbID = await getIMDbID(id, type);
            if (imdbID && imdbID !== id) {
                existingIndex = bookmarks.findIndex(item => item.id === imdbID && item.type === type);
            }
        } catch (error) {
            console.error("Error getting IMDB ID for bookmark:", error);
        }
    }

    if (existingIndex > -1) {
        // Remove from bookmarks
        bookmarks.splice(existingIndex, 1);
        if (bookmarkBtn) {
            bookmarkBtn.classList.remove('bookmarked');
            bookmarkBtn.style.background = 'rgba(0, 0, 0, 0.6)';
            bookmarkBtn.style.color = 'white';
            const svg = bookmarkBtn.querySelector('svg');
            if (svg) {
                svg.setAttribute('fill', 'none');
                svg.style.color = 'white';
            }
        }
        console.log('Removed from bookmarks:', title);
    } else {
        // Get the correct ID format for launching
        let launchId = id;
        try {
            // If this is a TMDB ID, convert to IMDB ID for proper launching
            if (type === 'movie' || type === 'tv') {
                launchId = imdbID || await getIMDbID(id, type) || id;
            }
        } catch (error) {
            console.error("Error getting IMDB ID for bookmark:", error);
        }

        // Check one more time to prevent duplicates with the final launch ID
        const finalCheck = bookmarks.findIndex(item => item.id === launchId && item.type === type);
        if (finalCheck === -1) {
            // Add to bookmarks with launch-ready ID
            bookmarks.push({
                id: launchId,
                type: type,
                title: title,
                poster: poster,
                timestamp: Date.now()
            });
            if (bookmarkBtn) {
                bookmarkBtn.classList.add('bookmarked');
                bookmarkBtn.style.background = '#fbbf24';
                bookmarkBtn.style.color = '#000';
                const svg = bookmarkBtn.querySelector('svg');
                if (svg) {
                    svg.setAttribute('fill', 'currentColor');
                    svg.style.color = '#000';
                }
            }
            console.log('Added to bookmarks:', title);
        }
    }

    localStorage.setItem('watchLater', JSON.stringify(bookmarks));

    // Refresh watch later section if on home page
    if (document.getElementById('homeSection') && document.getElementById('homeSection').style.display !== 'none') {
        displayWatchLaterSection();
    }
}

async function isBookmarked(id, type) {
    const bookmarks = JSON.parse(localStorage.getItem('watchLater')) || [];

    // Check with original ID first
    if (bookmarks.some(item => item.id === id && item.type === type)) {
        return true;
    }

    // Also check with IMDB ID conversion for TMDB IDs
    try {
        if (type === 'movie' || type === 'tv') {
            const imdbID = await getIMDbID(id, type);
            if (imdbID && imdbID !== id) {
                return bookmarks.some(item => item.id === imdbID && item.type === type);
            }
        }
    } catch (error) {
        // Ignore conversion errors, return false
    }

    return false;
}

// Community functionality
function toggleCommunity() {
    // Show community stats modal instead of full community
    showCommunityStats();
}

function showCommunityStats() {
    const statsModal = document.createElement('div');
    statsModal.style.position = 'fixed';
    statsModal.style.top = '0';
    statsModal.style.left = '0';
    statsModal.style.width = '100vw';
    statsModal.style.height = '100vh';
    statsModal.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    statsModal.style.display = 'flex';
    statsModal.style.alignItems = 'center';
    statsModal.style.justifyContent = 'center';
    statsModal.style.zIndex = '9999';
    statsModal.style.backdropFilter = 'blur(10px)';

    const modalContent = document.createElement('div');
    modalContent.style.background = 'var(--card-bg)';
    modalContent.style.borderRadius = '20px';
    modalContent.style.padding = '2rem';
    modalContent.style.maxWidth = '400px';
    modalContent.style.width = '90%';
    modalContent.style.textAlign = 'center';
    modalContent.style.border = '1px solid var(--border-color)';
    modalContent.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.3)';

    modalContent.innerHTML = `
        <div style="margin-bottom: 1.5rem;">
            <svg width="60" height="60" viewBox="0 0 24 24" fill="currentColor" style="color: var(--accent-primary); margin-bottom: 1rem;">
                <path d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2M4 18v-4h3v-3h2l3 3h6v4c0 1.11-.89 2-2 2H6c-1.11 0-2-.89-2-2M7.5 12c-.83 0-1.5-.67-1.5-1.5S6.67 9 7.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5"/>
            </svg>
            <h2 style="margin: 0; color: var(--text-primary); font-size: 1.5rem; font-weight: 700;">Community</h2>
        </div>
        
        <div style="margin-bottom: 1.5rem;">
            <div style="background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)); color: white; padding: 1rem; border-radius: 12px; margin-bottom: 1rem; font-weight: 600;">
                101.7K+ members in Community
            </div>
            <div style="background: rgba(255, 255, 255, 0.1); color: var(--text-primary); padding: 1rem; border-radius: 12px; margin-bottom: 1rem; font-weight: 600;">
                28.6K+ posts in community
            </div>
        </div>
        
        <div style="color: var(--text-secondary); line-height: 1.6; margin-bottom: 1.5rem; font-size: 0.9rem;">
            Sorry at this time only the developer or original site users can access community, you are currently on an admin version of the site please go to the community site to view community posts.
        </div>
        
        <button onclick="this.closest('.stats-modal').remove()" style="background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)); color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 12px; font-weight: 600; cursor: pointer; transition: all 0.3s ease;">
            Got it
        </button>
    `;

    statsModal.className = 'stats-modal';
    statsModal.appendChild(modalContent);
    document.body.appendChild(statsModal);

    // Close on click outside
    statsModal.addEventListener('click', (e) => {
        if (e.target === statsModal) {
            statsModal.remove();
        }
    });
}

function closeCommunity() {
    const communityContainer = document.getElementById('communityContainer');
    const communityOverlay = document.getElementById('communityOverlay');

    communityContainer.classList.remove('active');
    communityOverlay.classList.remove('active');

    // Re-enable background scroll
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
}

function loadCommunityPosts() {
    const feedContainer = document.getElementById('communityFeedMain');
    
    // Community is disabled - no posts to show
    feedContainer.innerHTML = `
        <div class="community-empty-state">
            <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor" style="opacity: 0.3; margin-bottom: 1rem;">
                    <path d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2M4 18v-4h3v-3h2l3 3h6v4c0 1.11-.89 2-2 2H6c-1.11 0-2-.89-2-2M7.5 12c-.83 0-1.5-.67-1.5-1.5S6.67 9 7.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5"/>
                </svg>
                <h3 style="margin: 0 0 0.5rem 0; color: var(--text-primary);">Community Coming Soon</h3>
                <p style="margin: 0; font-size: 0.9rem;">Community features are currently under development.</p>
            </div>
        </div>
    `;
}

function likePost(element) {
    const likeCount = element.querySelector('span');
    const currentLikes = parseInt(likeCount.textContent);
    likeCount.textContent = currentLikes + 1;

    // Add visual feedback
    element.style.color = 'var(--accent-primary)';
    element.querySelector('svg').style.fill = 'var(--accent-primary)';
}

// Search functionality
function toggleSearch() {
    const searchContainer = document.getElementById('searchContainer');
    const searchOverlay = document.getElementById('searchOverlay');

    searchContainer.classList.add('active');
    searchContainer.classList.remove('collapsed');
    searchOverlay.classList.add('active');

    // Prevent background scroll
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    // Simple mobile focus without complex positioning
    setTimeout(() => {
        const searchInput = document.getElementById('searchInput');
        searchInput.focus();
        searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
    }, 100);
}

function closeSearch() {
    const searchContainer = document.getElementById('searchContainer');
    const searchOverlay = document.getElementById('searchOverlay');

    searchContainer.classList.remove('active');
    searchContainer.classList.add('collapsed');
    searchOverlay.classList.remove('active');

    // Re-enable background scroll
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    document.body.classList.remove('search-open');

    // Clear search and hide keyboard
    const searchInput = document.getElementById('searchInput');
    searchInput.value = '';
    searchInput.blur();

    // Force hide mobile keyboard
    if (window.innerWidth <= 768) {
        // Create a temporary input to steal focus and hide keyboard
        const tempInput = document.createElement('input');
        tempInput.style.position = 'absolute';
        tempInput.style.left = '-9999px';
        tempInput.style.opacity = '0';
        document.body.appendChild(tempInput);
        tempInput.focus();
        setTimeout(() => {
            document.body.removeChild(tempInput);
        }, 100);
    }
}

// Section management
function showSection(sectionName) {
    console.log("Switching to section:", sectionName);

    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.add('hidden');
        section.style.display = 'none';
    });

    // Show selected section
    const targetSection = document.getElementById(sectionName + 'Section');
    if (targetSection) {
        targetSection.classList.remove('hidden');
        targetSection.style.display = 'block';
    }

    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.section === sectionName) {
            item.classList.add('active');
        }
    });

    // Load content based on section
    if (sectionName === 'explore') {
        // Load explore content if not already loaded
        fetchCategoryData(currentCategory);
    } else if (sectionName === 'home') {
        // Refresh home content
        displayResumeSection();
        displayWatchLaterSection();
        checkEmptyState();
    } else if (sectionName === 'settings') {
        // Sync mobile settings with desktop settings
        loadEnhancedMobileSettings();
    } else if (sectionName === 'profile') {
        // Load profile content
        loadProfileSection();
    } else if (sectionName === 'party') {
        // Party section - no special loading needed
    }
    
    // Scroll to top
    window.scrollTo(0, 0);
}

async function getMediaTitle(imdbID, type) {
    try {
        const response = await fetch(`https://www.omdbapi.com/?i=${imdbID}&apikey=756f44a5`);
        const data = await response.json();
        return data.Title || 'Unknown Title';
    } catch {
        return 'Unknown Title';
    }
}

async function getMediaPoster(imdbID, type) {
    try {
        const response = await fetch(`https://www.omdbapi.com/?i=${imdbID}&apikey=756f44a5`);
        const data = await response.json();
        return data.Poster || 'https://via.placeholder.com/300x450?text=No+Poster';
    } catch {
        return 'https://via.placeholder.com/300x450?text=No+Poster';
    }
}

async function getIMDbID(tmdbID, type = "movie") {
    const url = `${BASE_URL}/${type}/${tmdbID}/external_ids`;
    try {
        const res = await fetch(url, {
            headers: { Authorization: API_TOKEN }
        });
        const data = await res.json();
        return data.imdb_id || tmdbID;
    } catch (err) {
        console.error("IMDb ID error:", err);
        return tmdbID;
    }
}

// Cache for IMDB ratings to improve performance
const imdbCache = new Map();

async function getIMDbRating(imdbID) {
    if (!imdbID || imdbID.length < 7) return null;

    // Check cache first
    if (imdbCache.has(imdbID)) {
        return imdbCache.get(imdbID);
    }

    try {
        const response = await fetch(`https://www.omdbapi.com/?i=${imdbID}&apikey=756f44a5`);
        const data = await response.json();

        let rating = null;
        if (data.Response === "True" && data.imdbRating && data.imdbRating !== "N/A") {
            rating = data.imdbRating;
        }

        // Cache the result
        imdbCache.set(imdbID, rating);
        return rating;
    } catch (error) {
        console.error("IMDB rating error:", error);
        // Cache null result to avoid repeated failed requests
        imdbCache.set(imdbID, null);
        return null;
    }
}

const GENRES = {
    movie: {
        action: 28, comedy: 35, horror: 27, drama: 18, romance: 10749, "sci-fi": 878, thriller: 53, animation: 16, documentary: 99
    },
    tv: {
        action: 10759, comedy: 35, horror: 9648, drama: 18, romance: 10766, "sci-fi": 10765, thriller: 80, animation: 16, documentary: 99
    }
};

function getGenreId(name, type = "movie") {
    return GENRES[type]?.[name.toLowerCase()] || "";
}

function showLoading() {
    document.getElementById('loading').style.display = 'flex';
    document.getElementById('movies').style.display = 'none';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('movies').style.display = 'grid';
}

function displayResumeSection() {
    // Remove existing resume section to prevent duplicates
    const existingSection = document.querySelector('.resume-section');
    if (existingSection) {
        existingSection.remove();
    }

    const resumeItems = [];
    const seenIds = new Set(); // Track seen IDs to prevent duplicates

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('watchProgress_')) {
            const imdbId = key.replace('watchProgress_', '');

            // Skip if we've already seen this ID
            if (seenIds.has(imdbId)) {
                continue;
            }
            seenIds.add(imdbId);

            const data = JSON.parse(localStorage.getItem(key));
            if (data.currentTime > 0 && data.duration > 0) {
                const lastClicked = localStorage.getItem(`lastClicked_${imdbId}`);
                const lastUpdated = data.lastUpdated || 0;
                const priority = data.priority || 0;

                // Parse timestamps and ensure they're valid numbers
                const clickedTime = lastClicked ? parseInt(lastClicked) : 0;
                const updatedTime = lastUpdated || 0;

                // Use priority as the primary sort criteria, then most recent activity
                const primaryTime = Math.max(priority, clickedTime, updatedTime);

                resumeItems.push({ 
                    imdbId, 
                    type: data.type || 'movie',
                    title: data.title,
                    poster: data.poster,
                    season: data.season,
                    episodeId: data.episode,
                    progress: (data.currentTime / data.duration) * 100,
                    currentTime: data.currentTime,
                    duration: data.duration,
                    lastClicked: clickedTime,
                    lastUpdated: updatedTime,
                    priority: priority,
                    sortTime: primaryTime
                });
            }
        }
    }

    // Sort by most recent activity first with stable sorting
    resumeItems.sort((a, b) => {
        // Primary sort: most recent activity (priority > lastClicked > lastUpdated)
        const aPrimary = Math.max(a.priority || 0, a.lastClicked || 0, a.lastUpdated || 0);
        const bPrimary = Math.max(b.priority || 0, b.lastClicked || 0, b.lastUpdated || 0);
        
        if (aPrimary !== bPrimary) {
            return bPrimary - aPrimary; // Most recent first
        }
        
        // Secondary sort: by imdbId for stable ordering when times are equal
        return a.imdbId.localeCompare(b.imdbId);
    });

    if (resumeItems.length > 0) {
        const container = document.createElement('div');
        container.className = 'resume-section';
        container.innerHTML = '<h2>Continue Watching</h2><div class="resume-items"></div>';

        const homeSection = document.getElementById('homeSection');
        homeSection.insertBefore(container, homeSection.querySelector('.empty-state') || homeSection.firstChild.nextSibling);

        const itemsContainer = container.querySelector('.resume-items');

        resumeItems.forEach(async item => {
            const url = `${BASE_URL}/find/${item.imdbId}?external_source=imdb_id`;
            try {
                const res = await fetch(url, { headers: { Authorization: API_TOKEN } });
                const data = await res.json();
                const show = data.tv_results[0] || data.movie_results[0];

                if (show) {
                    const poster = show.poster_path ? IMG_BASE + show.poster_path : 'https://via.placeholder.com/300x450?text=No+Poster';
                    const title = show.title || show.name;
                    const type = show.title ? 'movie' : 'tv';

                    const resumeCard = document.createElement('div');
                    resumeCard.className = 'resume-card';

                    // Calculate time remaining and format
                    const timeLeft = Math.max(0, item.duration - item.currentTime);
                    const formatTimeRemaining = (seconds) => {
                        const hours = Math.floor(seconds / 3600);
                        const mins = Math.floor((seconds % 3600) / 60);

                        if (hours > 0) {
                            return `${hours}h ${mins}m left`;
                        } else if (mins > 0) {
                            return `${mins}m left`;
                        } else if (seconds > 0) {
                            return `<1m left`;
                        } else {
                            return `Finished`;
                        }
                    };

                    const timeRemainingText = formatTimeRemaining(timeLeft);

                    // Format episode info for TV shows with time remaining
                    const typeLabel = type === 'tv' ? `S${item.season || '?'} E${item.episodeId || '?'}` : (type ? 'Movie' : '?');
                    const episodeInfo = type === 'tv' ? 
                        `<div class="episode-info">
                            <span class="episode-season">${typeLabel}</span>
                            <span class="time-remaining">${timeRemainingText}</span>
                        </div>` : 
                        `<div class="episode-info">
                            <span class="episode-season">${typeLabel}</span>
                            <span class="time-remaining">${timeRemainingText}</span>
                        </div>`;

                    // Add episodes icon only for TV shows in continue watching
                    const episodesIcon = type === 'tv' ? 
                        `<button onclick="event.stopPropagation(); window.location.href='stream.html?imdb=${item.imdbId}'" class="episodes-icon">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/>
                            </svg>
                        </button>` : 
                        '';

                    // Check if time progress bar is enabled
                    const showTimeProgressBar = localStorage.getItem('showTimeProgress') !== 'false';
                    const timeProgressPercent = item.duration > 0 ? Math.round((timeLeft / item.duration) * 100) : 0;
                    const timeProgressBarHTML = showTimeProgressBar ? `
                        <div class="time-progress-bar">
                            <div class="time-progress-fill" style="width: ${timeProgressPercent}%"></div>
                        </div>
                    ` : '';

                    resumeCard.innerHTML = `
                        <div class="poster-container">
                            <img src="${poster}" alt="${title}" class="movie-poster">
                            <div class="play-overlay">
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                                    <path d="M6 4v16l12-8z"/>
                                </svg>
                            </div>
                        </div>
                        ${episodesIcon}
                        <div class="movie-info">
                            <h3 class="movie-title">${title}</h3>
                            ${episodeInfo}
                            ${timeProgressBarHTML}
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${item.progress}%"></div>
                            </div>
                        </div>
                    `;

                    // Add click event listener with timestamp update
                    resumeCard.addEventListener('click', () => {
                        // Update timestamps to ensure this item moves to front
                        const now = Date.now();
                        localStorage.setItem(`lastClicked_${item.imdbId}`, now);
                        
                        // Update the progress data with new priority
                        const progressKey = `watchProgress_${item.imdbId}`;
                        const progressData = JSON.parse(localStorage.getItem(progressKey));
                        if (progressData) {
                            progressData.priority = now;
                            progressData.lastUpdated = now;
                            localStorage.setItem(progressKey, JSON.stringify(progressData));
                        }

                        if (type === 'tv') {
                            window.location.href = `media.html?id=${item.imdbId}&season=${item.season}&episode=${item.episodeId}`;
                        } else {
                            window.location.href = `watch.html?id=${item.imdbId}&type=${type}`;
                        }
                    });
                    itemsContainer.appendChild(resumeCard);
                }
            } catch (error) {
                console.error("Error fetching resume item:", error);
            }
        });
    }
}

// Function to update the priority of a resumed item
function updatePriority(imdbId) {
    const key = `watchProgress_${imdbId}`;
    const item = JSON.parse(localStorage.getItem(key));
    if (item) {
        const now = Date.now();
        // Set priority higher than current time to ensure it stays at top
        item.priority = now + 1000; // Add buffer to ensure it's higher
        item.lastUpdated = now;
        localStorage.setItem(key, JSON.stringify(item));
        localStorage.setItem(`lastClicked_${imdbId}`, now);
        
        // Immediately refresh the display
        displayResumeSection();
    }
}

let currentPage = 1;

// Initialize the page
document.addEventListener("DOMContentLoaded", () => {
    // Show home section by default
    showSection('home');

    displayResumeSection();
    displayWatchLaterSection();

    // Periodic sorting checks for continue watching
    setInterval(() => {
        if (document.getElementById('homeSection').style.display !== 'none') {
            displayResumeSection();
        }
    }, 3000); // Check every 3 seconds

    // Additional sorting check after initial load
    setTimeout(() => {
        displayResumeSection();
        displayWatchLaterSection();
    }, 1000);

    setTimeout(() => {
        displayResumeSection();
        displayWatchLaterSection();
    }, 5000);

    // Load explore content for when user switches to it
    setTimeout(() => {
        fetchCategoryData("action");
    }, 500);

    // Add search on Enter key
    document.getElementById("searchInput").addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            e.preventDefault(); // Prevent form submission
            searchMovies();
            // Hide keyboard on mobile
            if (window.innerWidth <= 768) {
                e.target.blur();
            }
        }
    });

    // Close search on Escape key
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeSearch();
            closeSearchResults();
        }
    });

    // Add type filter change handler
    document.getElementById("typeFilter").addEventListener("change", () => {
        fetchCategoryData(currentCategory);
    });

    // Update user stats on page load
    setTimeout(() => {
        updateUserStats();
    }, 500);
});

function loadEnhancedMobileSettings() {
    // Load all mobile setting states
    const settings = JSON.parse(localStorage.getItem('luminaSettings')) || {};
    
    const toggles = {
        'mobileTransparentToggle': settings.transparentMode || localStorage.getItem('transparentMode') === 'true',
        'mobileAutoplayToggle': settings.autoplayEnabled !== false && localStorage.getItem('autoplayEnabled') !== 'false',
        'mobileSaveProgressToggle': settings.saveProgressEnabled !== false && localStorage.getItem('saveProgressEnabled') !== 'false',
        'mobileDeveloperModeToggle': settings.developerMode || localStorage.getItem('developerMode') === 'true',
        'mobileHideAnnouncementToggle': settings.hideAnnouncement || localStorage.getItem('hideAnnouncement') === 'true',
        'mobileHideTrendingToggle': settings.hideTrending || localStorage.getItem('hideTrending') === 'true'
    };

    Object.entries(toggles).forEach(([id, isActive]) => {
        const element = document.getElementById(id);
        if (element) {
            if (isActive) {
                element.classList.add('active');
            } else {
                element.classList.remove('active');
            }
            
            // Add click event listeners for toggles
            element.onclick = function() {
                toggleMobileSetting(id, element);
            };
        }
    });

    // Load accent color
    const savedColor = localStorage.getItem('accentColor') || 'purple';
    selectAccentColor(savedColor);
    
    // Update color options
    const colorOptions = document.querySelectorAll('.color-card, .color-option');
    colorOptions.forEach(card => {
        card.classList.remove('active');
        if (card.dataset.color === savedColor) {
            card.classList.add('active');
        }
    });
    
    // Apply current settings to the UI
    Object.entries(toggles).forEach(([id, isActive]) => {
        const settingMap = {
            'mobileTransparentToggle': 'transparentMode',
            'mobileAutoplayToggle': 'autoplayEnabled',
            'mobileSaveProgressToggle': 'saveProgressEnabled',
            'mobileDeveloperModeToggle': 'developerMode',
            'mobileHideAnnouncementToggle': 'hideAnnouncement',
            'mobileHideTrendingToggle': 'hideTrending'
        };
        
        const settingKey = settingMap[id];
        if (settingKey) {
            applySetting(settingKey, isActive);
        }
    });
    
    // Ensure first tab is active
    switchMobileTab('appearance');
}

function toggleMobileSetting(toggleId, element) {
    const isActive = element.classList.contains('active');
    const newState = !isActive;
    
    if (newState) {
        element.classList.add('active');
    } else {
        element.classList.remove('active');
    }
    
    // Map toggle IDs to setting keys
    const settingMap = {
        'mobileTransparentToggle': 'transparentMode',
        'mobileAutoplayToggle': 'autoplayEnabled',
        'mobileSaveProgressToggle': 'saveProgressEnabled',
        'mobileDeveloperModeToggle': 'developerMode',
        'mobilePreloadToggle': 'preloadNextEpisode',
        'mobileHideAnnouncementToggle': 'hideAnnouncement',
        'mobileHideTrendingToggle': 'hideTrending',
        'mobileHideGenresToggle': 'hideGenres',
        'mobileHideMoviesToggle': 'hideMovies'
    };
    
    const settingKey = settingMap[toggleId];
    if (settingKey) {
        // Save to both localStorage and luminaSettings
        localStorage.setItem(settingKey, newState.toString());
        
        const settings = JSON.parse(localStorage.getItem('luminaSettings')) || {};
        settings[settingKey] = newState;
        localStorage.setItem('luminaSettings', JSON.stringify(settings));
        
        // Apply setting immediately
        applySetting(settingKey, newState);
        
        // Special handling for transparency mode
        if (settingKey === 'transparentMode') {
            if (newState) {
                document.body.classList.add('transparent');
            } else {
                document.body.classList.remove('transparent');
            }
        }
        
        // Special handling for developer mode
        if (settingKey === 'developerMode') {
            if (typeof toggleDeveloperConsole === 'function') {
                const console = document.getElementById('developerConsole');
                if (console) {
                    console.style.display = newState ? 'flex' : 'none';
                }
            }
        }
    }
}

// Add individual toggle functions for better compatibility
function toggleMobileDeveloperMode() {
    const element = document.getElementById('mobileDeveloperModeToggle');
    toggleMobileSetting('mobileDeveloperModeToggle', element);
}

function selectAccentColor(color) {
    localStorage.setItem('accentColor', color);
    
    // Remove existing accent classes
    document.body.classList.forEach(cls => {
        if (cls.startsWith('accent-')) {
            document.body.classList.remove(cls);
        }
    });
    document.body.classList.add(`accent-${color}`);
    
    // Update active color card/option
    document.querySelectorAll('.color-card, .color-option').forEach(card => {
        card.classList.remove('active');
        if (card.dataset.color === color) {
            card.classList.add('active');
        }
    });
    
    // Update CSS variables based on color
    const colorMap = {
        'purple': { primary: '#8b5cf6', secondary: '#6366f1' },
        'red': { primary: '#ef4444', secondary: '#dc2626' },
        'green': { primary: '#10b981', secondary: '#059669' },
        'blue': { primary: '#3b82f6', secondary: '#2563eb' },
        'orange': { primary: '#f59e0b', secondary: '#d97706' },
        'pink': { primary: '#ec4899', secondary: '#db2777' }
    };
    
    const colors = colorMap[color] || colorMap['purple'];
    document.documentElement.style.setProperty('--accent-primary', colors.primary);
    document.documentElement.style.setProperty('--accent-secondary', colors.secondary);
}

function clearWatchHistory() {
    if (confirm('Are you sure you want to clear your watch history? This cannot be undone.')) {
        // Clear all watch progress items
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('watchProgress_') || key.startsWith('lastClicked_'))) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        // Refresh the page to update the UI
        alert('Watch history cleared successfully!');
        location.reload();
    }
}

function selectMobileColor(color) {
    selectAccentColor(color);
}

function toggleMobileTransparent() {
    const element = document.getElementById('mobileTransparentToggle');
    toggleMobileSetting('mobileTransparentToggle', element);
}

function toggleMobileAutoplay() {
    const element = document.getElementById('mobileAutoplayToggle');
    toggleMobileSetting('mobileAutoplayToggle', element);
}

function toggleMobileSaveProgress() {
    const element = document.getElementById('mobileSaveProgressToggle');
    toggleMobileSetting('mobileSaveProgressToggle', element);
}

function toggleMobileHideAnnouncement() {
    const element = document.getElementById('mobileHideAnnouncementToggle');
    toggleMobileSetting('mobileHideAnnouncementToggle', element);
}

function toggleMobileHideTrending() {
    const element = document.getElementById('mobileHideTrendingToggle');
    toggleMobileSetting('mobileHideTrendingToggle', element);
}

function applySetting(settingKey, value) {
    switch(settingKey) {
        case 'hideTrending':
            const trendingSection = document.querySelector('.trending-section');
            if (trendingSection) {
                trendingSection.style.display = value ? 'none' : 'block';
            }
            break;
        case 'hideAnnouncement':
            const announcementSection = document.getElementById('announcementSection');
            if (announcementSection) {
                announcementSection.style.display = value ? 'none' : 'block';
            }
            break;
        case 'hideGenres':
            const categoriesSection = document.querySelector('.categories-section');
            if (categoriesSection) {
                categoriesSection.style.display = value ? 'none' : 'block';
            }
            break;
        case 'hideMovies':
            const moviesSection = document.getElementById('movies');
            if (moviesSection) {
                moviesSection.style.display = value ? 'none' : 'grid';
            }
            break;
        case 'transparentMode':
            if (value) {
                document.body.classList.add('transparent');
            } else {
                document.body.classList.remove('transparent');
            }
            break;
        case 'developerMode':
            // Developer mode is handled by individual pages
            if (typeof toggleDeveloperConsole === 'function') {
                const console = document.getElementById('developerConsole');
                if (console) {
                    console.style.display = value ? 'flex' : 'none';
                }
            }
            break;
        default:
            // Other settings are applied by individual components
            break;
    }
}

function updateUserStats() {
    // Count movies watched
    let moviesWatched = 0;
    let episodesWatched = 0;
    let totalHours = 0;

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('watchProgress_')) {
            const data = JSON.parse(localStorage.getItem(key));
            if (data.type === 'movie') {
                moviesWatched++;
            } else {
                episodesWatched++;
            }
            totalHours += (data.duration || 0) / 3600;
        }
    }

    const bookmarks = JSON.parse(localStorage.getItem('watchLater')) || [];

    // Update UI
    const moviesCount = document.getElementById('moviesWatchedCount');
    const episodesCount = document.getElementById('episodesWatchedCount');
    const hoursCount = document.getElementById('hoursWatchedCount');
    const bookmarksCount = document.getElementById('bookmarksCount');

    if (moviesCount) moviesCount.textContent = moviesWatched;
    if (episodesCount) episodesCount.textContent = episodesWatched;
    if (hoursCount) hoursCount.textContent = Math.round(totalHours);
    if (bookmarksCount) bookmarksCount.textContent = bookmarks.length;
}

// Settings functions
function showSettingsPage(pageName) {
    // Hide main menu
    document.getElementById('settingsMainMenu').classList.add('hidden');
    
    // Show selected page
    document.querySelectorAll('.settings-page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageName + 'Page').classList.add('active');
    
    // Update navigation
    document.getElementById('settingsBackBtn').style.display = 'flex';
    document.getElementById('settingsNavTitle').textContent = getPageTitle(pageName);
}

function showSettingsMenu() {
    // Show main menu
    document.getElementById('settingsMainMenu').classList.remove('hidden');
    
    // Hide all pages
    document.querySelectorAll('.settings-page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Update navigation
    document.getElementById('settingsBackBtn').style.display = 'none';
    document.getElementById('settingsNavTitle').textContent = 'Settings';
}

function getPageTitle(pageName) {
    const titles = {
        'appearance': 'Theme & Appearance',
        'playback': 'Video & Playback',
        'interface': 'Interface Layout',
        'advanced': 'Advanced Settings'
    };
    return titles[pageName] || 'Settings';
}

function switchMobileTab(tabName) {
    // Legacy function - redirect to new system
    showSettingsPage(tabName);
}

// Community interface
function showAuth() {
    alert('Authentication coming soon!');
}

function loadProfileSection() {
    console.log('Profile section loaded');
}

// Updates Popup Function
function showUpdatesPopup() {
    const overlay = document.createElement('div');
    overlay.className = 'updates-popup-overlay active';
    overlay.onclick = closeUpdatesPopup;

    const popup = document.createElement('div');
    popup.className = 'updates-popup active';

    popup.innerHTML = `
        <div class="updates-header">
            <h2 class="updates-title">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10 20h4v2h-4zm6-20H8c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V2c0-1.1-.9-2-2-2zm-2 18h-4v-2h4v2zm2-8H8V4h8v6z"/>
                </svg>
                Updates & News
            </h2>
            <button class="updates-close-btn" onclick="closeUpdatesPopup()">×</button>
        </div>
        <div class="updates-content">
            <div class="update-item">
                <h5>🎉 NEW UPDATE v1.517: Enhanced Settings Panel</h5>
                <p>Beautiful new settings interface with modern UI, extra accent color mods, advanced animations, and improved mobile experience!</p>
            </div>
            <div class="update-item">
                <h5>✨ RECENT UPDATES: Stream HTML Redesign</h5>
                <p>Stream redesign with accent color matching, fixed season dropdown styling, enhanced trending section with proper bookmarks, and improved continue watching with better ordering.</p>
            </div>
            <div class="update-item">
                <h5>🎨 FEATURES: Glass Mode & Themes</h5>
                <p>Glass Mode transparency, Enhanced color themes (Purple, Red, Green, Blue, Orange, Pink), Skip Intro/Credits, Preload episodes, Hide UI sections, Developer Mode, and more!</p>
            </div>
            <div class="update-item">
                <h5>📱 MOBILE IMPROVEMENTS</h5>
                <p>Better responsive design with improved spacing, progress bars on continue watching cards, modern settings interface, and megaphone updates button.</p>
            </div>
            <div class="update-item">
                <h5>ℹ️ IMPORTANT</h5>
                <p>Lumina displays content from third-party sources and does not host or control any media. For the best experience, visit the main website at molnsc.github.io</p>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(popup);

    // Prevent background scroll
    document.body.style.overflow = 'hidden';
}

function closeUpdatesPopup() {
    const overlay = document.querySelector('.updates-popup-overlay');
    const popup = document.querySelector('.updates-popup');
    
    if (overlay) overlay.remove();
    if (popup) popup.remove();
    
    // Re-enable background scroll
    document.body.style.overflow = '';
}
// Party Functions
function createParty() {
    alert('Watch Party feature is coming soon! Stay tuned for updates.');
}

function joinParty() {
    const partyCode = prompt('Enter Party Code:');
    if (partyCode) {
        alert('Watch Party feature is coming soon! Stay tuned for updates.');
    }
}

// Time Progress Bar Toggle
function toggleMobileTimeProgress() {
    const element = document.getElementById('mobileTimeProgressToggle');
    if (element) {
        const isActive = element.classList.contains('active');
        const newState = !isActive;
        
        if (newState) {
            element.classList.add('active');
        } else {
            element.classList.remove('active');
        }
        
        localStorage.setItem('showTimeProgress', newState.toString());
        const settings = JSON.parse(localStorage.getItem('luminaSettings')) || {};
        settings.showTimeProgress = newState;
        localStorage.setItem('luminaSettings', JSON.stringify(settings));
    }
}

function toggleMobileHideFilters() {
    const element = document.getElementById('mobileHideFiltersToggle');
    if (element) {
        const isActive = element.classList.contains('active');
        const newState = !isActive;
        
        if (newState) {
            element.classList.add('active');
        } else {
            element.classList.remove('active');
        }
        
        localStorage.setItem('hideFilters', newState.toString());
        const settings = JSON.parse(localStorage.getItem('luminaSettings')) || {};
        settings.hideFilters = newState;
        localStorage.setItem('luminaSettings', JSON.stringify(settings));
        
        const filtersSection = document.querySelector('.filters-section');
        if (filtersSection) {
            filtersSection.style.display = newState ? 'none' : 'block';
        }
    }
}

function toggleMobileHideGenres() {
    const element = document.getElementById('mobileHideGenresToggle');
    if (element) {
        const isActive = element.classList.contains('active');
        const newState = !isActive;
        
        if (newState) {
            element.classList.add('active');
        } else {
            element.classList.remove('active');
        }
        
        localStorage.setItem('hideGenres', newState.toString());
        const settings = JSON.parse(localStorage.getItem('luminaSettings')) || {};
        settings.hideGenres = newState;
        localStorage.setItem('luminaSettings', JSON.stringify(settings));
        
        const genresSection = document.querySelector('.categories-section');
        if (genresSection) {
            genresSection.style.display = newState ? 'none' : 'block';
        }
    }
}

// Settings Tab Switcher for Mobile
function switchMobileTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.settings-tab-mobile').forEach(tab => {
        tab.classList.remove('active');
    });
    const activeTab = document.querySelector(`.settings-tab-mobile[data-tab="${tabName}"]`);
    if (activeTab) {
        activeTab.classList.add('active');
    }
    
    // Update tab content
    document.querySelectorAll('.settings-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    const activeContent = document.getElementById(`${tabName}-tab`);
    if (activeContent) {
        activeContent.classList.add('active');
    }
}


// Initialize settings on page load
document.addEventListener('DOMContentLoaded', function() {
    // Load time progress setting
    const timeProgressEnabled = localStorage.getItem('showTimeProgress') !== 'false';
    const timeProgressToggle = document.getElementById('mobileTimeProgressToggle');
    if (timeProgressToggle && timeProgressEnabled) {
        timeProgressToggle.classList.add('active');
    }
    
    // Load hide filters setting
    if (localStorage.getItem('hideFilters') === 'true') {
        const toggle = document.getElementById('mobileHideFiltersToggle');
        if (toggle) toggle.classList.add('active');
    }
    
    // Load hide genres setting
    if (localStorage.getItem('hideGenres') === 'true') {
        const toggle = document.getElementById('mobileHideGenresToggle');
        if (toggle) toggle.classList.add('active');
    }
});
