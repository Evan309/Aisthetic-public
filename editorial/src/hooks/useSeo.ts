import { useEffect } from 'react';

const SEO_MARKER = 'data-aisthetic-seo';

type MetaDefinition = {
    name?: string;
    property?: string;
    content: string;
};

type LinkDefinition = {
    rel: string;
    href: string;
};

interface SeoConfig {
    title: string;
    meta?: MetaDefinition[];
    links?: LinkDefinition[];
    structuredData?: Record<string, unknown> | null;
}

function applyMetaTag(definition: MetaDefinition) {
    const selector = definition.name
        ? `meta[name="${definition.name}"]`
        : `meta[property="${definition.property}"]`;

    const elements = Array.from(document.head.querySelectorAll<HTMLMetaElement>(selector));
    let element = elements[0];
    if (!element) {
        element = document.createElement('meta');
        document.head.appendChild(element);
    }
    for (const duplicate of elements.slice(1)) {
        duplicate.remove();
    }

    element.setAttribute(SEO_MARKER, 'true');
    if (definition.name) {
        element.setAttribute('name', definition.name);
    } else if (definition.property) {
        element.setAttribute('property', definition.property);
    }

    element.setAttribute('content', definition.content);
}

function applyLinkTag(definition: LinkDefinition) {
    const selector = `link[rel="${definition.rel}"]`;
    const elements = Array.from(document.head.querySelectorAll<HTMLLinkElement>(selector));
    let element = elements[0];
    if (!element) {
        element = document.createElement('link');
        document.head.appendChild(element);
    }
    for (const duplicate of elements.slice(1)) {
        duplicate.remove();
    }

    element.setAttribute(SEO_MARKER, 'true');
    element.setAttribute('rel', definition.rel);
    element.setAttribute('href', definition.href);
}

export function useSeo({ title, meta = [], links = [], structuredData = null }: SeoConfig) {
    const metaKey = JSON.stringify(meta);
    const linksKey = JSON.stringify(links);
    const structuredDataKey = JSON.stringify(structuredData);

    useEffect(() => {
        document.title = title;

        for (const definition of meta) {
            applyMetaTag(definition);
        }

        for (const definition of links) {
            applyLinkTag(definition);
        }

        if (structuredData) {
            const existingScripts = Array.from(document.head.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]'));
            const script = existingScripts[0] ?? document.createElement('script');
            for (const duplicate of existingScripts.slice(1)) {
                duplicate.remove();
            }

            script.type = 'application/ld+json';
            script.setAttribute(SEO_MARKER, 'true');
            script.textContent = JSON.stringify(structuredData);
            if (!script.parentElement) {
                document.head.appendChild(script);
            }
        } else {
            const managedStructuredData = document.head.querySelector<HTMLScriptElement>(`script[type="application/ld+json"][${SEO_MARKER}]`);
            managedStructuredData?.remove();
        }

        return () => {
            const managedNodes = document.head.querySelectorAll(`[${SEO_MARKER}]`);
            managedNodes.forEach((node) => node.remove());
        };
    }, [title, meta, links, structuredData, metaKey, linksKey, structuredDataKey]);
}
