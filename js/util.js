// https://stackoverflow.com/questions/3452546/how-do-i-get-the-youtube-video-id-from-a-url
export function getYoutubeIdFromUrl(url) {
    return url.match(
        /.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=)([^#\&\?]*).*/,
    )?.[1] ?? '';
}

export function embed(video) {
    return `https://www.youtube.com/embed/${getYoutubeIdFromUrl(video)}`;
}

/**
 * Determine the video type from a URL
 * @returns {'youtube'|'telegram'|'external'}
 */
export function getVideoType(url) {
    if (!url) return 'external';
    if (url.match(/youtu\.?be/)) return 'youtube';
    if (url.match(/t\.me\//)) return 'telegram';
    return 'external';
}

/**
 * Get embed-ready video info
 * @returns {{ type: string, src: string, original: string }}
 */
export function getVideoInfo(url) {
    const type = getVideoType(url);
    if (type === 'youtube') {
        return { type, src: embed(url), original: url };
    }
    if (type === 'telegram') {
        // Convert t.me/c/CHAT_ID/MSG_ID to t.me/c/CHAT_ID/MSG_ID?embed=1
        const embedUrl = url.includes('?') ? `${url}&embed=1` : `${url}?embed=1`;
        return { type, src: embedUrl, original: url };
    }
    return { type, src: url, original: url };
}

export function localize(num) {
    return num.toLocaleString(undefined, { minimumFractionDigits: 3 });
}

export function getThumbnailFromId(id) {
    return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
}

// https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
export function shuffle(array) {
    let currentIndex = array.length, randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex != 0) {
        // Pick a remaining element.
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex],
            array[currentIndex],
        ];
    }

    return array;
}
