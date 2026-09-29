import React from 'react';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { curatedClosets } from '../src/data/closets.ts';
import App from '../src/App.tsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');
const TEMPLATE_PATH = path.join(DIST_DIR, 'index.html');
const SITE_URL = 'https://www.aisthetic.shop';

const staticRoutes = ['/', '/about', '/closets', '/privacy'];
const dynamicRoutes = curatedClosets.map(c => `/closets/${c.id}`);
const ROUTES = [...staticRoutes, ...dynamicRoutes];

function buildRouteHead(route: string): string {
    if (route === '/') {
        return `
<title>Aisthetic Editorial | Curated Closets</title>
<meta name="description" content="Discover seasonal capsules, trend-focused edits, and the infinite possibilities of an AI-powered wardrobe." />
<meta property="og:title" content="Aisthetic Editorial | Curated Closets" />
<meta property="og:description" content="Discover seasonal capsules, trend-focused edits, and the infinite possibilities of an AI-powered wardrobe." />
<meta property="og:image" content="${SITE_URL}/images/Closets/Spring_2026_wardrobe/spring_capsule_2026_hero.jpg" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${SITE_URL}/" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="canonical" href="${SITE_URL}/" />
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Aisthetic Editorial","url":"${SITE_URL}/"}</script>`.trim();
    }

    if (route === '/about') {
        return `
<title>About | Aisthetic Editorial</title>
<meta name="description" content="AIsthetic is a fashion discovery platform focused on curated style inspiration and editorial closets." />
<meta property="og:title" content="About | Aisthetic Editorial" />
<meta property="og:description" content="AIsthetic is a fashion discovery platform focused on curated style inspiration and editorial closets." />
<meta property="og:image" content="${SITE_URL}/images/Closets/Quiet_luxury/chic_hero.jpg" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${SITE_URL}/about" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="canonical" href="${SITE_URL}/about" />`.trim();
    }

    if (route === '/closets') {
        return `
<title>All Collections | Aisthetic Editorial</title>
<meta name="description" content="Browse every Aisthetic Editorial closet, from seasonal capsules to aesthetic-driven wardrobe edits." />
<meta property="og:title" content="All Collections | Aisthetic Editorial" />
<meta property="og:description" content="Browse every Aisthetic Editorial closet, from seasonal capsules to aesthetic-driven wardrobe edits." />
<meta property="og:image" content="${SITE_URL}/images/Closets/Spring_2026_wardrobe/spring_capsule_2026_hero.jpg" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${SITE_URL}/closets" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="canonical" href="${SITE_URL}/closets" />`.trim();
    }

    if (route === '/privacy') {
        return `
<title>Privacy Policy | Aisthetic Editorial</title>
<meta name="description" content="Read Aisthetic Editorial's privacy policy and affiliate disclosure." />
<meta property="og:title" content="Privacy Policy | Aisthetic Editorial" />
<meta property="og:description" content="Read Aisthetic Editorial's privacy policy and affiliate disclosure." />
<meta property="og:type" content="website" />
<meta property="og:url" content="${SITE_URL}/privacy" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="canonical" href="${SITE_URL}/privacy" />`.trim();
    }

    const closet = curatedClosets.find((entry) => `/closets/${entry.id}` === route);
    if (!closet) {
        return `
<title>Page Not Found | Aisthetic Editorial</title>
<meta name="robots" content="noindex, nofollow" />`.trim();
    }

    const url = `${SITE_URL}/closets/${closet.id}`;
    const schemaData = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: closet.title,
        image: [`${SITE_URL}${closet.imageUrl}`],
        author: [{ '@type': 'Person', name: closet.curator }],
        publisher: {
            '@type': 'Organization',
            name: 'Aisthetic',
            logo: {
                '@type': 'ImageObject',
                url: `${SITE_URL}/favicon.svg`,
            },
        },
        description: closet.excerpt,
    };

    return `
<title>${closet.title} | Aisthetic Editorial</title>
<meta name="description" content="${closet.excerpt}" />
<meta property="og:title" content="${closet.title} | Curated Closet" />
<meta property="og:description" content="${closet.excerpt}" />
<meta property="og:image" content="${SITE_URL}${closet.imageUrl}" />
<meta property="og:url" content="${url}" />
<meta property="og:type" content="article" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="canonical" href="${url}" />
<script type="application/ld+json">${JSON.stringify(schemaData)}</script>`.trim();
}

function injectRouteMarkup(template: string, route: string): string {
    const appMarkup = renderToString(
        React.createElement(
            StaticRouter,
            { location: route },
            React.createElement(App)
        )
    );
    const headMarkup = buildRouteHead(route);

    return template
        .replace('<title>Aisthetic Editorial</title>', '')
        .replace('<!--app-head-->', headMarkup)
        .replace('<div id="root"></div>', `<div id="root">${appMarkup}</div>`);
}

async function prerenderRoutes(): Promise<void> {
    console.log('[Prerender] Generating static HTML routes...');
    const template = await fs.readFile(TEMPLATE_PATH, 'utf8');

    for (const route of ROUTES) {
        console.log(`[Prerender] Rendering route: ${route}`);
        try {
            const html = injectRouteMarkup(template, route);
            const routePath = route === '/' ? '/index.html' : `${route}/index.html`;
            const filePath = path.join(DIST_DIR, routePath);
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, html);
            console.log(`[Prerender] Saved: ${filePath}`);
        } catch (err) {
            console.error(`[Prerender] Failed to render ${route}:`, err);
        }
    }
    console.log('[Prerender] Finished generating static HTML.');
}

prerenderRoutes().catch(console.error);
