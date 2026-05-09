/**
 * archive.js - microCMS content fetching and rendering
 * Redesigned for Notion-like cards and chronological navigation
 */

let allPosts = [];

document.addEventListener('DOMContentLoaded', () => {
    const archiveGrid = document.querySelector('.archive-grid');
    const archivePreviewGrid = document.querySelector('.archive-preview .archive-grid');
    const postDetailContainer = document.querySelector('.archive-post');

    // Archive List Page
    if (archiveGrid && !archivePreviewGrid) {
        initArchiveList();
        initFilterNav();
    }

    // Top Page Archive Preview
    if (archivePreviewGrid) {
        initArchivePreview();
    }

    // Post Detail Page
    if (postDetailContainer) {
        initPostDetail();
    }
});

/**
 * Fetch data from microCMS
 */
async function fetchMicroCMS(endpoint, params = {}) {
    const url = new URL(`https://${CONFIG.MICROCMS_SERVICE_DOMAIN}.microcms.io/api/v1/${endpoint}`);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    const response = await fetch(url.toString(), {
        headers: {
            'X-MICROCMS-API-KEY': CONFIG.MICROCMS_API_KEY
        }
    });

    if (!response.ok) {
        throw new Error('Network response was not ok');
    }

    return await response.json();
}

/**
 * Initialize Archive List Page
 */
async function initArchiveList() {
    const archiveGrid = document.querySelector('.archive-grid');
    archiveGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 4rem;">読み込み中...</div>';

    try {
        const data = await fetchMicroCMS(CONFIG.MICROCMS_ENDPOINT);
        allPosts = data.contents;
        renderGroupedArchive('all');
    } catch (error) {
        console.error('Error fetching archive:', error);
        archiveGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 4rem;">記事の読み込みに失敗しました。</div>';
    }
}

/**
 * Initialize Filter Navigation
 */
function initFilterNav() {
    const tabs = document.querySelectorAll('.filter-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const unit = tab.dataset.unit;
            renderGroupedArchive(unit);
        });
    });
}

/**
 * Group posts by date unit
 */
function groupPosts(posts, unit) {
    const groups = {};

    posts.forEach(post => {
        const date = new Date(post.publishedAt || post.createdAt);
        let key = '';

        if (unit === 'year') {
            key = `${date.getFullYear()}年`;
        } else if (unit === 'month') {
            key = `${date.getFullYear()}年 ${date.getMonth() + 1}月`;
        } else if (unit === 'week') {
            const startOfWeek = new Date(date);
            startOfWeek.setDate(date.getDate() - date.getDay());
            key = `${startOfWeek.getFullYear()}年 ${startOfWeek.getMonth() + 1}月 第${Math.ceil(date.getDate() / 7)}週`;
        } else {
            key = 'all';
        }

        if (!groups[key]) groups[key] = [];
        groups[key].push(post);
    });

    return groups;
}

/**
 * Render Grouped Archive Items
 */
function renderGroupedArchive(unit) {
    const container = document.querySelector('.archive-grid');
    if (allPosts.length === 0) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 4rem;">記事がありません。</div>';
        return;
    }

    if (unit === 'all') {
        container.innerHTML = '';
        renderPostCards(allPosts, container);
        return;
    }

    const grouped = groupPosts(allPosts, unit);
    container.innerHTML = '';

    // Sort keys descending
    const keys = Object.keys(grouped).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

    keys.forEach(key => {
        const header = document.createElement('h3');
        header.className = 'archive-group-header';
        header.textContent = key;
        container.appendChild(header);

        renderPostCards(grouped[key], container);
    });
}

/**
 * Render List of Cards
 */
function renderPostCards(posts, container) {
    posts.forEach(post => {
        const date = new Date(post.publishedAt || post.createdAt).toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).replace(/\//g, '.');

        const imageUrl = post.eyecatch ? post.eyecatch.url : 'images/DSCF0399.jpg';
        const excerpt = post.content ? post.content.replace(/<[^>]*>?/gm, '').substring(0, 60) + '...' : '';

        const article = document.createElement('article');
        article.className = 'archive-item';
        article.innerHTML = `
            <a href="archive-detail.html?id=${post.id}" class="archive-link">
                <div class="archive-image">
                    <img src="${imageUrl}" alt="${post.title}">
                </div>
                <div class="archive-content">
                    <span class="archive-date">${date}</span>
                    <h4 class="archive-title">${post.title}</h4>
                    <p class="archive-excerpt">${excerpt}</p>
                </div>
            </a>
        `;
        container.appendChild(article);
    });
}

/**
 * Initialize Archive Preview on Top Page
 */
async function initArchivePreview() {
    const previewGrid = document.querySelector('.archive-preview .archive-grid');

    try {
        const data = await fetchMicroCMS(CONFIG.MICROCMS_ENDPOINT, { limit: 2 });
        renderPostCards(data.contents, previewGrid);
    } catch (error) {
        console.error('Error fetching preview:', error);
    }
}

/**
 * Initialize Post Detail Page
 */
async function initPostDetail() {
    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('id');
    const draftKey = urlParams.get('draftKey');

    if (!postId) {
        window.location.href = 'archive.html';
        return;
    }

    try {
        const params = draftKey ? { draftKey: draftKey } : {};
        const post = await fetchMicroCMS(`${CONFIG.MICROCMS_ENDPOINT}/${postId}`, params);
        renderPostDetail(post);

        // Also fetch related for "Look Back"
        initLookBack(post);
    } catch (error) {
        console.error('Error fetching post detail:', error);
        const container = document.querySelector('.post-container');
        if (container) container.innerHTML = '<div style="text-align: center; padding: 4rem;">記事の読み込みに失敗しました。</div>';
    }
}

/**
 * Initialize Look Back section on Detail Page
 */
async function initLookBack(currentPost) {
    const postDate = new Date(currentPost.publishedAt || currentPost.createdAt);
    const year = postDate.getFullYear();
    const month = postDate.getMonth() + 1;

    const lookBackSection = document.createElement('section');
    lookBackSection.className = 'section look-back';
    lookBackSection.innerHTML = `
        <div class="container">
            <div class="section-header">
                <span class="subtitle">LOOK BACK</span>
                <h3>${year}年${month}月の思い出</h3>
            </div>
            <div class="archive-grid" id="look-back-grid"></div>
        </div>
    `;

    document.querySelector('main').appendChild(lookBackSection);
    const grid = document.getElementById('look-back-grid');

    try {
        // Simple strategy: fetch latest posts and filter by month locally for now
        // A better API query would be filters=publishedAt[contains]2023-04
        const data = await fetchMicroCMS(CONFIG.MICROCMS_ENDPOINT, { limit: 10 });
        const related = data.contents.filter(p => {
            const d = new Date(p.publishedAt || p.createdAt);
            return d.getFullYear() === year && (d.getMonth() + 1) === month && p.id !== currentPost.id;
        });

        if (related.length > 0) {
            renderPostCards(related, grid);
        } else {
            // If no posts in same month, show latest 2
            const latest = data.contents.filter(p => p.id !== currentPost.id).slice(0, 2);
            lookBackSection.querySelector('h3').textContent = '最近の旅の記録';
            renderPostCards(latest, grid);
        }
    } catch (error) {
        console.error('Error in Look Back:', error);
    }
}

/**
 * Render Post Detail
 */
function renderPostDetail(post) {
    const title = document.querySelector('.post-title');
    const date = document.querySelector('.post-date');
    const hero = document.querySelector('.post-hero');
    const content = document.querySelector('.post-content');

    document.title = `${post.title} | Tour Archive | 丹探（タンサク）`;

    if (title) title.innerHTML = post.title.replace(/\n/g, '<br>');

    if (date) {
        const dateObj = new Date(post.publishedAt || post.createdAt);
        date.textContent = dateObj.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).replace(/\//g, '.');
    }

    if (hero && post.eyecatch) {
        hero.style.backgroundImage = `url('${post.eyecatch.url}')`;
    }

    if (content) {
        content.innerHTML = post.content;
        
        const wrapWithLightbox = (fig) => {
            const img = fig.querySelector('img');
            if (img && !img.parentNode.hasAttribute('data-fslightbox')) {
                const a = document.createElement('a');
                a.href = img.src;
                a.setAttribute('data-fslightbox', 'post-gallery');
                fig.insertBefore(a, img);
                a.appendChild(img);
            }
        };

        // Extract all figures
        const figures = Array.from(content.querySelectorAll('figure'));
        
        if (figures.length > 0) {
            // Remove old gallery headers/lines
            const hrs = content.querySelectorAll('hr');
            if (hrs.length > 0) hrs[hrs.length - 1].remove();
            
            const headings = content.querySelectorAll('h2, h3');
            headings.forEach(h => {
                if (h.textContent.includes('ギャラリー') || h.textContent.includes('Gallery') || h.textContent.includes('写真')) {
                    h.remove();
                }
            });

            // Detach all figures from their original position
            figures.forEach(fig => fig.remove());

            // Find valid paragraphs to insert images after
            const paragraphs = Array.from(content.querySelectorAll('p'));
            const validPoints = paragraphs.filter(p => {
                const text = p.textContent.trim();
                // Exclude empty paragraphs and "fake headings" like 【午前：城下町の...】
                return text !== '' && !text.match(/^【.*】$/);
            });

            let figIndex = 0;
            
            // Distribute one image after each valid paragraph block
            validPoints.forEach((p) => {
                if (figIndex < figures.length) {
                    const fig = figures[figIndex];
                    fig.className = 'editorial-figure'; // Apply wide editorial style
                    wrapWithLightbox(fig);
                    
                    if (p.nextSibling) {
                        p.parentNode.insertBefore(fig, p.nextSibling);
                    } else {
                        p.parentNode.appendChild(fig);
                    }
                    figIndex++;
                }
            });

            // Any remaining images become a masonry tile gallery at the bottom
            if (figIndex < figures.length) {
                const leftoverGallery = document.createElement('div');
                leftoverGallery.className = 'rich-tile-gallery';
                
                // Add a small spacer/divider
                const divider = document.createElement('div');
                divider.style.margin = '5rem 0 3rem';
                divider.style.borderTop = '1px dashed #ddd';
                content.appendChild(divider);
                
                content.appendChild(leftoverGallery);
                
                for (; figIndex < figures.length; figIndex++) {
                    const fig = figures[figIndex];
                    fig.className = ''; // Standard tile style
                    wrapWithLightbox(fig);
                    leftoverGallery.appendChild(fig);
                }
            }
        }
    }

    if (typeof refreshFsLightbox === 'function') {
        refreshFsLightbox();
    }
}

// trigger vercel deploy
