(() => {
    if (window.__anchorHashFixInstalled) return;
    window.__anchorHashFixInstalled = true;

    const SELECTOR = document.documentElement.dataset.anchorHeaderSelector || 'header';
    const FALLBACK = parseFloat(document.documentElement.dataset.anchorHeaderFallback || '72') || 72;

    const getHeader = () => document.querySelector(SELECTOR);
    const headerOffset = () => {
        const el = getHeader();
        const h = el ? el.offsetHeight : FALLBACK;
        document.documentElement.style.setProperty('--header-offset', h + 'px');
        return h;
    };

    function scrollToHash(hash) {
        if (!hash) return;
        const id = decodeURIComponent(hash.replace(/^#/, ''));
        const el = document.getElementById(id);
        if (!el) return;
        el.scrollIntoView({ block: 'start' });
        const y = el.getBoundingClientRect().top + window.scrollY - headerOffset();
        window.scrollTo({ top: Math.max(0, y) });
    }

    const reapplyHash = () => {
        if (!location.hash) return;
        scrollToHash(location.hash);
        window.addEventListener('load', () => scrollToHash(location.hash), { once: true });
        requestAnimationFrame(() => scrollToHash(location.hash));
        setTimeout(() => scrollToHash(location.hash), 350);
    };

    const headerEl = getHeader();
    if (headerEl && 'ResizeObserver' in window) {
        new ResizeObserver(() => headerOffset()).observe(headerEl);
    }
    window.addEventListener('orientationchange', headerOffset, { passive: true });
    window.addEventListener('resize', headerOffset, { passive: true });
    window.addEventListener('hashchange', () => scrollToHash(location.hash), { passive: true });

    headerOffset();
    reapplyHash();
})();
