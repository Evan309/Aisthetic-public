import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { curatedClosets } from '../src/data/closets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOMAIN = 'https://aisthetic.shop';
const SITEMAP_PATH = path.resolve(__dirname, '../public/sitemap.xml');
const ROBOTS_PATH = path.resolve(__dirname, '../public/robots.txt');

function generateSitemap() {
    const staticUrls = [
        '/',
        '/about',
        '/closets'
    ];

    const dynamicUrls = curatedClosets.map(closet => `/closets/${closet.id}`);

    const allUrls = [...staticUrls, ...dynamicUrls];

    const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${allUrls.map(url => `
    <url>
        <loc>${DOMAIN}${url}</loc>
        <changefreq>${url === '/' ? 'daily' : 'weekly'}</changefreq>
        <priority>${url === '/' ? '1.0' : '0.8'}</priority>
    </url>`).join('')}
</urlset>`;

    fs.writeFileSync(SITEMAP_PATH, sitemapContent.trim());
    console.log('[SEO] Generated sitemap.xml');
}

function generateRobotsBase() {
    const robotsContent = `User-agent: *
Allow: /

Sitemap: ${DOMAIN}/sitemap.xml
`;
    fs.writeFileSync(ROBOTS_PATH, robotsContent.trim());
    console.log('[SEO] Generated robots.txt');
}

generateSitemap();
generateRobotsBase();
