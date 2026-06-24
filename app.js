/* ============================================
   COURSEFORGE — APPLICATION LOGIC
   ============================================ */

class CourseForge {
    constructor() {
        this.API_BASE = 'https://www.googleapis.com/youtube/v3';
        this.apiKey = localStorage.getItem('cf_api_key') || '';
        this.currentCourse = null;
        this.progress = JSON.parse(localStorage.getItem('cf_progress') || '{}');

        this.init();
    }

    // ---- Initialization ----
    init() {
        this.cacheDOM();
        this.bindEvents();

        // Restore API key
        if (this.apiKey) {
            this.els.apiKeyInput.value = this.apiKey;
        }
    }

    cacheDOM() {
        this.els = {
            // Views
            landingView: document.getElementById('landing-view'),
            loadingView: document.getElementById('loading-view'),
            courseView: document.getElementById('course-view'),

            // Form
            courseForm: document.getElementById('course-form'),
            topicInput: document.getElementById('topic-input'),
            apiKeyInput: document.getElementById('api-key-input'),
            buildBtn: document.getElementById('build-btn'),
            toggleApiKey: document.getElementById('toggle-api-key'),
            apiKeyContainer: document.getElementById('api-key-container'),
            toggleKeyVisibility: document.getElementById('toggle-key-visibility'),

            // Loading
            loadingStatus: document.getElementById('loading-status'),
            stepSearch: document.getElementById('step-search'),
            stepOrganize: document.getElementById('step-organize'),
            stepBuild: document.getElementById('step-build'),

            // Course
            courseTopicTitle: document.getElementById('course-topic-title'),
            totalVideos: document.getElementById('total-videos'),
            totalTime: document.getElementById('total-time'),
            totalProgress: document.getElementById('total-progress'),
            overallProgressFill: document.getElementById('overall-progress-fill'),
            levelsContainer: document.getElementById('levels-container'),
            backBtn: document.getElementById('back-btn'),
            resetProgressBtn: document.getElementById('reset-progress-btn'),

            // Modal
            videoModal: document.getElementById('video-modal'),
            closeModal: document.getElementById('close-modal'),
            videoPlayerContainer: document.getElementById('video-player-container'),
            modalVideoTitle: document.getElementById('modal-video-title'),
            modalVideoChannel: document.getElementById('modal-video-channel'),

            // Toast
            toastContainer: document.getElementById('toast-container'),
        };
    }

    bindEvents() {
        this.els.courseForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.buildCourse();
        });

        this.els.toggleApiKey.addEventListener('click', () => {
            const container = this.els.apiKeyContainer;
            const btn = this.els.toggleApiKey;
            container.classList.toggle('collapsed');
            btn.classList.toggle('open');
        });

        this.els.toggleKeyVisibility.addEventListener('click', () => {
            const input = this.els.apiKeyInput;
            input.type = input.type === 'password' ? 'text' : 'password';
        });

        this.els.backBtn.addEventListener('click', () => this.showView('landing'));
        this.els.resetProgressBtn.addEventListener('click', () => this.resetProgress());

        this.els.closeModal.addEventListener('click', () => this.closeVideoModal());
        this.els.videoModal.addEventListener('click', (e) => {
            if (e.target === this.els.videoModal) this.closeVideoModal();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeVideoModal();
        });
    }

    // ---- View Management ----
    showView(name) {
        ['landing', 'loading', 'course'].forEach((v) => {
            const el = document.getElementById(`${v}-view`);
            el.classList.remove('active');
        });
        const target = document.getElementById(`${name}-view`);
        // small delay for transition
        requestAnimationFrame(() => {
            target.classList.add('active');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // ---- Toast Notifications ----
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icons = {
            success: '✓',
            error: '✗',
            info: 'ℹ',
        };
        toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span> ${message}`;
        this.els.toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('exiting');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    // ---- Loading Steps ----
    setLoadingStep(step) {
        const steps = ['search', 'organize', 'build'];
        const idx = steps.indexOf(step);

        steps.forEach((s, i) => {
            const el = document.getElementById(`step-${s}`);
            el.classList.remove('active', 'done');
            if (i < idx) el.classList.add('done');
            if (i === idx) el.classList.add('active');
        });

        const messages = {
            search: 'Searching for the best tutorials...',
            organize: 'Organizing content by difficulty...',
            build: 'Building your personalized curriculum...',
        };
        this.els.loadingStatus.textContent = messages[step] || '';
    }

    // ---- Build Course ----
    async buildCourse() {
        const topic = this.els.topicInput.value.trim();
        if (!topic) return;

        const apiKey = this.els.apiKeyInput.value.trim();
        if (!apiKey) {
            this.showToast('Please enter your YouTube API key to search for tutorials.', 'error');
            this.els.apiKeyContainer.classList.remove('collapsed');
            this.els.toggleApiKey.classList.add('open');
            this.els.apiKeyInput.focus();
            return;
        }

        // Save API key
        this.apiKey = apiKey;
        localStorage.setItem('cf_api_key', apiKey);

        this.showView('loading');
        this.setLoadingStep('search');

        try {
            // Step 1: Search for videos at each level
            const levels = [
                { key: 'beginner', label: 'Beginner', emoji: '🌱', queries: [`${topic} tutorial for beginners`, `${topic} introduction crash course`] },
                { key: 'intermediate', label: 'Intermediate', emoji: '🔥', queries: [`${topic} intermediate tutorial`, `${topic} in depth guide`] },
                { key: 'advanced', label: 'Advanced', emoji: '🚀', queries: [`${topic} advanced tutorial`, `${topic} expert masterclass`] },
            ];

            const courseData = [];

            for (const level of levels) {
                const videos = await this.searchVideos(level.queries, 8);
                courseData.push({ ...level, videos });
            }

            // Step 2: Organize and get video details
            this.setLoadingStep('organize');
            await this.sleep(600);

            // Get durations for all videos
            const allVideoIds = courseData.flatMap((l) => l.videos.map((v) => v.id));
            const details = await this.getVideoDetails(allVideoIds);

            // Merge details into videos
            courseData.forEach((level) => {
                level.videos = level.videos
                    .map((v) => {
                        const detail = details[v.id];
                        if (detail) {
                            v.duration = detail.duration;
                            v.durationSeconds = detail.durationSeconds;
                            v.viewCount = detail.viewCount;
                            v.likeCount = detail.likeCount;
                        }
                        return v;
                    })
                    .filter((v) => v.durationSeconds && v.durationSeconds > 60) // filter very short videos
                    .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)) // sort by views
                    .slice(0, 6); // keep top 6
            });

            // Step 3: Build curriculum
            this.setLoadingStep('build');
            await this.sleep(600);

            this.currentCourse = {
                topic,
                createdAt: new Date().toISOString(),
                levels: courseData,
            };

            this.renderCourse();
            this.showView('course');
            this.showToast(`Course for "${topic}" is ready!`, 'success');
        } catch (err) {
            console.error('Build course error:', err);
            this.showView('landing');
            if (err.message.includes('403') || err.message.includes('401')) {
                this.showToast('Invalid API key or quota exceeded. Please check your YouTube API key.', 'error');
            } else {
                this.showToast(`Error: ${err.message}`, 'error');
            }
        }
    }

    // ---- YouTube API ----
    async searchVideos(queries, maxPerQuery = 8) {
        const seen = new Set();
        const results = [];

        for (const query of queries) {
            const url = new URL(`${this.API_BASE}/search`);
            url.searchParams.set('key', this.apiKey);
            url.searchParams.set('part', 'snippet');
            url.searchParams.set('q', query);
            url.searchParams.set('type', 'video');
            url.searchParams.set('maxResults', maxPerQuery);
            url.searchParams.set('order', 'relevance');
            url.searchParams.set('videoDuration', 'medium'); // 4-20 min preferred
            url.searchParams.set('relevanceLanguage', 'en');

            const res = await fetch(url.toString());
            if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);
            const data = await res.json();

            for (const item of data.items || []) {
                const id = item.id.videoId;
                if (!seen.has(id)) {
                    seen.add(id);
                    results.push({
                        id,
                        title: this.decodeHTML(item.snippet.title),
                        channel: item.snippet.channelTitle,
                        thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
                        publishedAt: item.snippet.publishedAt,
                    });
                }
            }
        }

        return results;
    }

    async getVideoDetails(videoIds) {
        const details = {};
        // API supports up to 50 IDs per request
        const chunks = this.chunkArray(videoIds, 50);

        for (const chunk of chunks) {
            const url = new URL(`${this.API_BASE}/videos`);
            url.searchParams.set('key', this.apiKey);
            url.searchParams.set('part', 'contentDetails,statistics');
            url.searchParams.set('id', chunk.join(','));

            const res = await fetch(url.toString());
            if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);
            const data = await res.json();

            for (const item of data.items || []) {
                const dur = this.parseISO8601Duration(item.contentDetails.duration);
                details[item.id] = {
                    duration: dur.formatted,
                    durationSeconds: dur.totalSeconds,
                    viewCount: parseInt(item.statistics.viewCount || '0'),
                    likeCount: parseInt(item.statistics.likeCount || '0'),
                };
            }
        }

        return details;
    }

    // ---- Render Course ----
    renderCourse() {
        const course = this.currentCourse;
        if (!course) return;

        this.els.courseTopicTitle.textContent = course.topic;

        // Calculate totals
        let totalVids = 0;
        let totalSecs = 0;

        course.levels.forEach((level) => {
            totalVids += level.videos.length;
            totalSecs += level.videos.reduce((sum, v) => sum + (v.durationSeconds || 0), 0);
        });

        this.els.totalVideos.textContent = totalVids;
        this.els.totalTime.textContent = this.formatDuration(totalSecs);

        // Render levels
        this.els.levelsContainer.innerHTML = '';

        course.levels.forEach((level) => {
            const levelSecs = level.videos.reduce((sum, v) => sum + (v.durationSeconds || 0), 0);
            const completedCount = level.videos.filter((v) =>
                this.isVideoCompleted(course.topic, v.id)
            ).length;
            const progressPct = level.videos.length > 0
                ? Math.round((completedCount / level.videos.length) * 100)
                : 0;

            const circumference = 2 * Math.PI * 15;
            const dashOffset = circumference - (progressPct / 100) * circumference;

            const levelColor = {
                beginner: '#34d399',
                intermediate: '#fbbf24',
                advanced: '#f87171',
            }[level.key];

            const card = document.createElement('div');
            card.className = 'level-card';
            card.dataset.level = level.key;

            card.innerHTML = `
                <div class="level-header">
                    <div class="level-header-left">
                        <div class="level-badge">${level.emoji}</div>
                        <div class="level-info">
                            <h2>${level.label}</h2>
                            <div class="level-meta">
                                <span>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                                        <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                                    </svg>
                                    ${level.videos.length} videos
                                </span>
                                <span>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                                    </svg>
                                    ${this.formatDuration(levelSecs)}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="level-header-right">
                        <div class="level-progress-ring">
                            <svg width="40" height="40" viewBox="0 0 40 40">
                                <circle class="ring-bg" cx="20" cy="20" r="15" fill="none" stroke-width="3"/>
                                <circle class="ring-fill" cx="20" cy="20" r="15" fill="none"
                                    stroke="${levelColor}" stroke-width="3"
                                    stroke-dasharray="${circumference}"
                                    stroke-dashoffset="${dashOffset}"
                                    stroke-linecap="round"/>
                            </svg>
                            <span class="level-progress-text">${progressPct}%</span>
                        </div>
                        <svg class="level-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                            <path d="m6 9 6 6 6-6"/>
                        </svg>
                    </div>
                </div>
                <div class="level-videos">
                    <div class="videos-list">
                        ${level.videos.map((v) => this.renderVideoCard(v, course.topic)).join('')}
                    </div>
                </div>
            `;

            // Toggle expand
            card.querySelector('.level-header').addEventListener('click', () => {
                card.classList.toggle('expanded');
            });

            this.els.levelsContainer.appendChild(card);
        });

        // Bind video card events
        this.bindVideoCardEvents();
        this.updateOverallProgress();
    }

    renderVideoCard(video, topic) {
        const isCompleted = this.isVideoCompleted(topic, video.id);
        return `
            <div class="video-card ${isCompleted ? 'completed' : ''}" data-video-id="${video.id}">
                <div class="video-checkbox" data-action="toggle-complete">
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" width="14" height="14">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                </div>
                <div class="video-thumbnail" data-action="play">
                    <img src="${video.thumbnail}" alt="${video.title}" loading="lazy"/>
                    ${video.duration ? `<span class="video-duration-badge">${video.duration}</span>` : ''}
                </div>
                <div class="video-info" data-action="play">
                    <div class="video-title">${video.title}</div>
                    <div class="video-channel">${video.channel}</div>
                    <div class="video-stats">
                        ${video.viewCount ? `<span>${this.formatNumber(video.viewCount)} views</span>` : ''}
                        ${video.duration ? `<span>${video.duration}</span>` : ''}
                    </div>
                </div>
                <button class="video-play-btn" data-action="play" title="Play video">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                </button>
            </div>
        `;
    }

    bindVideoCardEvents() {
        this.els.levelsContainer.querySelectorAll('.video-card').forEach((card) => {
            const videoId = card.dataset.videoId;
            const video = this.findVideo(videoId);

            card.addEventListener('click', (e) => {
                const action = e.target.closest('[data-action]')?.dataset.action;
                if (action === 'toggle-complete') {
                    this.toggleVideoComplete(videoId, card);
                } else if (action === 'play') {
                    this.openVideoModal(video);
                }
            });
        });
    }

    // ---- Progress Tracking ----
    isVideoCompleted(topic, videoId) {
        const key = `${topic}::${videoId}`;
        return !!this.progress[key];
    }

    toggleVideoComplete(videoId, cardEl) {
        const topic = this.currentCourse.topic;
        const key = `${topic}::${videoId}`;

        if (this.progress[key]) {
            delete this.progress[key];
            cardEl.classList.remove('completed');
        } else {
            this.progress[key] = true;
            cardEl.classList.add('completed');
        }

        localStorage.setItem('cf_progress', JSON.stringify(this.progress));
        this.updateOverallProgress();
        this.updateLevelProgressRings();
    }

    updateOverallProgress() {
        if (!this.currentCourse) return;
        const topic = this.currentCourse.topic;
        let total = 0;
        let completed = 0;

        this.currentCourse.levels.forEach((level) => {
            level.videos.forEach((v) => {
                total++;
                if (this.isVideoCompleted(topic, v.id)) completed++;
            });
        });

        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
        this.els.totalProgress.textContent = `${pct}%`;
        this.els.overallProgressFill.style.width = `${pct}%`;
    }

    updateLevelProgressRings() {
        if (!this.currentCourse) return;
        const topic = this.currentCourse.topic;

        this.currentCourse.levels.forEach((level) => {
            const card = this.els.levelsContainer.querySelector(`[data-level="${level.key}"]`);
            if (!card) return;

            const completedCount = level.videos.filter((v) =>
                this.isVideoCompleted(topic, v.id)
            ).length;
            const pct = level.videos.length > 0
                ? Math.round((completedCount / level.videos.length) * 100)
                : 0;

            const circumference = 2 * Math.PI * 15;
            const dashOffset = circumference - (pct / 100) * circumference;

            const ring = card.querySelector('.ring-fill');
            const text = card.querySelector('.level-progress-text');
            if (ring) ring.setAttribute('stroke-dashoffset', dashOffset);
            if (text) text.textContent = `${pct}%`;
        });
    }

    resetProgress() {
        if (!this.currentCourse) return;
        const topic = this.currentCourse.topic;

        // Remove only current course progress
        Object.keys(this.progress).forEach((key) => {
            if (key.startsWith(`${topic}::`)) {
                delete this.progress[key];
            }
        });

        localStorage.setItem('cf_progress', JSON.stringify(this.progress));
        this.renderCourse();
        this.showToast('Progress has been reset.', 'info');
    }

    // ---- Video Modal ----
    openVideoModal(video) {
        if (!video) return;
        this.els.videoPlayerContainer.innerHTML = `
            <iframe
                src="https://www.youtube.com/embed/${video.id}?autoplay=1&rel=0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
            ></iframe>
        `;
        this.els.modalVideoTitle.textContent = video.title;
        this.els.modalVideoChannel.textContent = video.channel;
        this.els.videoModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeVideoModal() {
        this.els.videoModal.classList.remove('active');
        this.els.videoPlayerContainer.innerHTML = '';
        document.body.style.overflow = '';
    }

    // ---- Utilities ----
    findVideo(videoId) {
        if (!this.currentCourse) return null;
        for (const level of this.currentCourse.levels) {
            const found = level.videos.find((v) => v.id === videoId);
            if (found) return found;
        }
        return null;
    }

    parseISO8601Duration(iso) {
        const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return { formatted: '0:00', totalSeconds: 0 };

        const h = parseInt(match[1] || '0');
        const m = parseInt(match[2] || '0');
        const s = parseInt(match[3] || '0');
        const totalSeconds = h * 3600 + m * 60 + s;

        let formatted;
        if (h > 0) {
            formatted = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        } else {
            formatted = `${m}:${String(s).padStart(2, '0')}`;
        }

        return { formatted, totalSeconds };
    }

    formatDuration(totalSeconds) {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);

        if (h > 0 && m > 0) return `${h}h ${m}m`;
        if (h > 0) return `${h}h`;
        return `${m}m`;
    }

    formatNumber(num) {
        if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
        if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
        return num.toString();
    }

    decodeHTML(html) {
        const txt = document.createElement('textarea');
        txt.innerHTML = html;
        return txt.value;
    }

    chunkArray(arr, size) {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
        }
        return chunks;
    }

    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

// ---- Boot ----
document.addEventListener('DOMContentLoaded', () => {
    window.courseForge = new CourseForge();
});
