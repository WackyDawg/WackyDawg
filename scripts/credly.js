import axios from 'axios';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://www.credly.com';
const README_PATH = path.resolve('README.md');
const SECTION_START = '<!--START_SECTION:badges-->';
const SECTION_END = '<!--END_SECTION:badges-->';
const IMAGE_SIZE = '340x340';


const CREDLY_USER = process.argv[2] || 'julian-nwadinobi.aa0c6c6c';

const client = axios.create({
    baseURL: BASE_URL,
    headers: {
        'accept': 'application/json',
        'accept-language': 'en-US,en;q=0.9',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
    },
});

async function fetchUserProfile(vanitySlug) {
    const response = await client.get(`/users/${vanitySlug}`, {
        headers: { referer: `${BASE_URL}/users/${vanitySlug}` },
    });
    return response.data.data;
}

async function fetchUserBadges(syntheticId, vanitySlug, page = 1, pageSize = 48) {
    const response = await client.get(`/users/${syntheticId}/badges`, {
        params: { page, page_size: pageSize },
        headers: { referer: `${BASE_URL}/users/${vanitySlug}/badges` },
    });
    return response.data;
}

function toHighResUrl(imageUrl) {
    return imageUrl.replace(
        'https://images.credly.com/images/',
        `https://images.credly.com/size/${IMAGE_SIZE}/images/`
    );
}

function generateBadgeHTML(badges) {
    const items = badges.map((badge) => {
        const name = badge.badge_template.name;
        const badgeUrl = `https://www.credly.com/badges/${badge.id}`;
        const imageUrl = toHighResUrl(badge.image_url);
        return `<a href="${badgeUrl}" title="${name}"><img src="${imageUrl}" alt="${name}" width="110" height="110" /></a>`;
    });

    return `<p>\n${items.join('\n')}\n</p>`;
}

function updateReadme(badgeHTML) {
    if (!fs.existsSync(README_PATH)) {
        throw new Error(`README.md not found at: ${README_PATH}`);
    }

    const content = fs.readFileSync(README_PATH, 'utf8');

    if (!content.includes(SECTION_START) || !content.includes(SECTION_END)) {
        throw new Error(`Section markers not found in README.md. Add:\n${SECTION_START}\n${SECTION_END}`);
    }

    const updated = content.replace(
        new RegExp(`${SECTION_START}[\\s\\S]*?${SECTION_END}`),
        `${SECTION_START}\n${badgeHTML}\n${SECTION_END}`
    );

    fs.writeFileSync(README_PATH, updated, 'utf8');
    console.log('README.md updated successfully.');
}

async function run() {
    console.log(`Fetching profile for: ${CREDLY_USER}`);
    const profile = await fetchUserProfile(CREDLY_USER);
    console.log(`Found user: ${profile.first_name} ${profile.last_name} (${profile.synthetic_id})`);

    const { data: badges, metadata } = await fetchUserBadges(profile.synthetic_id, CREDLY_USER);
    console.log(`Total badges: ${metadata?.total_count ?? badges.length}`);

    const badgeHTML = generateBadgeHTML(badges);
    updateReadme(badgeHTML);
}

run().catch((error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message ?? error.message;
    console.error(`[Error] ${status ? `HTTP ${status}: ` : ''}${message}`);
    process.exit(1);
});