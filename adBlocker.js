// adBlocker.js
const AdBlocker = {
    // Lista de dominios comunes de publicidad
    adDomains: [
        'doubleclick.net',
        'googlesyndication.com',
        'adnxs.com',
        'facebook.com/tr',
        'amazon-adsystem.com',
        'criteo.com',
        'outbrain.com',
        'taboola.com',
        'adroll.com',
        'pubmatic.com',
        'rubiconproject.com',
        'advertising.com',
        'adtechus.com',
        'moatads.com',
        'bidswitch.net',
        'openx.net',
        'casalemedia.com'
    ],

    // Lista de selectores CSS comunes de anuncios
    adSelectors: [
        '[id*="google_ads"]',
        '[id*="ad-"]',
        '[class*="ad-"]',
        '[id*="banner"]',
        '[class*="banner"]',
        '[id*="advert"]',
        '[class*="advert"]',
        'iframe[src*="ad"]',
        'iframe[id*="google_ads"]',
        '[id*="sponsored"]',
        '[class*="sponsored"]',
        '[data-ad]',
        '[id*="taboola"]',
        '[class*="taboola"]',
        '[id*="outbrain"]',
        '[class*="outbrain"]'
    ],

    // Reglas de bloqueo
    blockRules: [],
    
    // Configuración del sistema anti-popups
    popupConfig: {
        maxPopupsPerSecond: 0,
        blockNewWindows: true,
        blockTabHijacking: true,
        preventRedirects: true,
        blockBackgroundTabs: true,
        preventWindowManipulation: true,
        blockAllPopups: true
    },

    // Estado del sistema anti-popups
    popupState: {
        popupCount: 0,
        lastPopupTime: 0,
        originalWindowFeatures: {
            location: window.location,
            opener: window.opener
        },
        isFirstUserInteraction: false
    },

    async init() {
        await this.loadBlockedRules();
        this.setupRequestInterception();
        this.removeAdsFromDOM();
        this.setupMutationObserver();
        this.initAggressivePopupBlocker();
        console.log('Enhanced AdBlocker initialized with EasyList rules');
    },

    async loadBlockedRules() {
        try {
            const response = await fetch('/path/to/blocked.json');
            const data = await response.json();
            
            // Procesar las reglas de bloqueo
            this.blockRules = data.blockedUrls
                .filter(rule => !rule.startsWith('!') && !rule.startsWith('['))
                .map(rule => this.parseBlockRule(rule));

            console.log(`Loaded ${this.blockRules.length} blocking rules`);
        } catch (error) {
            console.error('Error loading blocking rules:', error);
        }
    },

    parseBlockRule(rule) {
        // Eliminar comentarios inline si existen
        rule = rule.split('!')[0].trim();

        // Extraer los modificadores de dominio
        const domainMatch = rule.match(/\$domain=([^,\s]+)/);
        const excludedDomains = domainMatch ? 
            domainMatch[1].split('|')
                .filter(d => d.startsWith('~'))
                .map(d => d.slice(1)) : [];

        // Extraer el tipo de recurso
        const typeMatch = rule.match(/\$(~?(?:image|script|stylesheet|xmlhttprequest|subdocument|third-party))/);
        const resourceType = typeMatch ? typeMatch[1] : null;

        // Convertir el patrón a expresión regular
        let pattern = rule
            .split('$')[0]                    
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')  
            .replace(/\\\*/g, '.*')           
            .replace(/\\\^/g, '(?:[^\\w\\-.%]|$)');  

        return {
            pattern: new RegExp(pattern),
            excludedDomains,
            resourceType
        };
    },

    shouldBlockRequest(url, type, domain) {
        return this.blockRules.some(rule => {
            // Verificar si el dominio está excluido
            if (rule.excludedDomains.includes(domain)) {
                return false;
            }

            // Verificar el tipo de recurso si está especificado
            if (rule.resourceType && !this.matchesResourceType(type, rule.resourceType)) {
                return false;
            }

            // Verificar el patrón de URL
            return rule.pattern.test(url);
        });
    },

    matchesResourceType(actualType, ruleType) {
        if (ruleType.startsWith('~')) {
            return actualType !== ruleType.slice(1);
        }
        return actualType === ruleType;
    },

    setupRequestInterception() {
        // Crear un nuevo URLPattern para cada dominio de publicidad
        const adPatterns = this.adDomains.map(domain => 
            new URLPattern({ hostname: `*.${domain}` })
        );

        // Interceptar fetch
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const url = args[0] instanceof Request ? args[0].url : args[0];
            const domain = new URL(url).hostname;
            
            if (this.shouldBlockRequest(url, 'xmlhttprequest', domain) || 
                adPatterns.some(pattern => pattern.test(url))) {
                console.log(`Blocked fetch request to: ${url}`);
                return new Response('', { status: 200 });
            }
            
            return originalFetch.apply(window, args);
        };

        // Interceptar XMLHttpRequest
        const originalXHROpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(...args) {
            const url = args[1];
            const domain = new URL(url).hostname;
            
            if (AdBlocker.shouldBlockRequest(url, 'xmlhttprequest', domain) ||
                adPatterns.some(pattern => pattern.test(url))) {
                console.log(`Blocked XHR request to: ${url}`);
                args[1] = 'about:blank';
            }
            
            return originalXHROpen.apply(this, args);
        };
    },

    removeAdsFromDOM() {
        // Aplicar reglas CSS
        const styleRules = this.blockRules
            .filter(rule => !rule.resourceType || rule.resourceType === 'stylesheet')
            .map(rule => rule.pattern.source)
            .join(',\n');

        if (styleRules) {
            const style = document.createElement('style');
            style.textContent = `${styleRules} { display: none !important; }`;
            document.head.appendChild(style);
        }

        // Eliminar elementos existentes que coincidan con las reglas y selectores
        const elements = document.querySelectorAll(this.adSelectors.join(','));
        elements.forEach(element => {
            element.remove();
            console.log('Removed ad element:', element);
        });

        this.blockRules.forEach(rule => {
            if (!rule.resourceType || rule.resourceType === 'stylesheet') {
                document.querySelectorAll(rule.pattern.source).forEach(element => {
                    element.remove();
                    console.log('Removed element matching rule:', rule.pattern);
                });
            }
        });

        // Limpiar iframes sospechosos
        document.querySelectorAll('iframe').forEach(iframe => {
            try {
                const iframeUrl = iframe.src || iframe.getAttribute('src');
                if (this.adDomains.some(domain => iframeUrl?.includes(domain))) {
                    iframe.remove();
                    console.log('Removed ad iframe:', iframeUrl);
                }
            } catch (e) {
                // Ignorar errores de seguridad al acceder a iframes de otros dominios
            }
        });
    },

    setupMutationObserver() {
        // Crear un observador para detectar cambios en el DOM
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { // Solo elementos
                        // Verificar si el elemento coincide con algún selector
                        if (this.adSelectors.some(selector => 
                            node.matches && node.matches(selector)
                        )) {
                            node.remove();
                            console.log('Removed dynamically added ad:', node);
                        }

                        // Verificar iframes añadidos dinámicamente
                        if (node.tagName === 'IFRAME') {
                            const iframeUrl = node.src || node.getAttribute('src');
                            if (this.adDomains.some(domain => iframeUrl?.includes(domain))) {
                                node.remove();
                                console.log('Removed dynamic ad iframe:', iframeUrl);
                            }
                        }
                    }
                });
            });
        });

        // Configurar y iniciar el observador
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    },

    initAggressivePopupBlocker() {
        this.blockAllWindowOpening();
        this.preventTabHijacking();
        this.blockRedirects();
        this.preventWindowManipulation();
        this.handleUserInteractions();
        this.blockBackgroundTabs();
        this.preventPopunder();
    },

    blockAllWindowOpening() {
        // Sobrescribir completamente window.open
        window.open = function() {
            console.log('Blocked popup window attempt');
            return null;
        };

        // Bloquear showModalDialog si existe
        if (window.showModalDialog) {
            window.showModalDialog = function() {
                console.log('Blocked modal dialog attempt');
                return null;
            };
        }

        // Bloquear target="_blank" en enlaces
        document.addEventListener('click', (e) => {
            if (e.target.tagName === 'A' && (
                e.target.target === '_blank' || 
                e.target.target === '_new' || 
                e.target.rel?.includes('popup')
            )) {
                e.preventDefault();
                console.log('Blocked link popup attempt');
            }
        }, true);

        // Bloquear window.openDialog si existe
        if (window.openDialog) {
            window.openDialog = function() {
                console.log('Blocked dialog attempt');
                return null;
            };
        }
    },

    preventTabHijacking() {
        // Bloquear modificaciones al histórico
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        history.pushState = function(...args) {
            if (AdBlocker.popupConfig.blockTabHijacking) {
                console.log('Blocked history.pushState attempt');
                return;
            }
            return originalPushState.apply(this, args);
        };

        history.replaceState = function(...args) {
            if (AdBlocker.popupConfig.blockTabHijacking) {
                console.log('Blocked history.replaceState attempt');
                return;
            }
            return originalReplaceState.apply(this, args);
        };

        // Prevenir cambios en location
        Object.defineProperty(window, 'location', {
            configurable: false,
            get: () => AdBlocker.popupState.originalWindowFeatures.location,
            set: (value) => {
                if (AdBlocker.popupConfig.blockTabHijacking) {
                    console.log('Blocked location change attempt');
                    return AdBlocker.popupState.originalWindowFeatures.location;
                }
                AdBlocker.popupState.originalWindowFeatures.location = value;
            }
        });
    },

    blockRedirects() {
        // Interceptar eventos beforeunload
        window.addEventListener('beforeunload', (event) => {
            if (this.popupConfig.preventRedirects) {
                event.preventDefault();
                event.returnValue = '';
                console.log('Blocked potential redirect');
            }
        }, true);

        // Monitorear cambios en meta refresh
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    const metaTags = document.getElementsByTagName('meta');
                    for (const meta of metaTags) {
                        if (meta.httpEquiv?.toLowerCase() === 'refresh') {
                            meta.remove();
                            console.log('Removed meta refresh redirect');
                        }
                    }
                }
            });
        });

        observer.observe(document.head, {
            childList: true,
            subtree: true
        });
    },

    preventWindowManipulation() {
        const blockedMethods = [
            'moveTo', 'moveBy', 'resizeTo', 'resizeBy', 
            'focus', 'blur', 'open', 'alert', 'confirm', 
            'prompt', 'print', 'showModalDialog'
        ];

        blockedMethods.forEach(method => {
            if (window[method]) {
                window[method] = function() {
                    console.log(`Blocked window.${method} attempt`);
                    return null;
                };
            }
        });

        // Bloquear modificaciones de tamaño y posición
        Object.defineProperties(window, {
            'innerWidth': { configurable: false, writable: false },
            'innerHeight': { configurable: false, writable: false },
            'outerWidth': { configurable: false, writable: false },
            'outerHeight': { configurable: false, writable: false },
            'screenX': { configurable: false, writable: false },
            'screenY': { configurable: false, writable: false }
        });
    },

    handleUserInteractions() {
        // No es necesario manejar interacciones ya que bloqueamos todo
        this.popupState.isFirstUserInteraction = false;
    },

    blockBackgroundTabs() {
        // Prevenir apertura de pestañas en segundo plano
        document.addEventListener('click', (event) => {
            if (event.target.tagName === 'A' && event.target.target === '_blank') {
                event.preventDefault();
                console.log('Blocked background tab attempt');
            }
        }, true);
    },

    preventPopunder() {
        // Bloquear técnicas comunes de popunder
        window.addEventListener('load', () => {
            // Prevenir blur forzado
            window.addEventListener('blur', (event) => {
                if (document.activeElement === document.body) {
                    window.focus();
                }
            });

            // Bloquear intentos de click-under
            document.addEventListener('mouseup', (event) => {
                setTimeout(() => {
                    if (document.activeElement === document.body) {
                        window.focus();
                    }
                }, 0)}, true);
            });
    
            // Mantener el foco en la ventana actual
            setInterval(() => {
                if (document.hasFocus() && window.opener) {
                    window.focus();
                }
            }, 500);
        }
    };
    
    // Inicializar el bloqueador cuando el DOM esté listo
    document.addEventListener('DOMContentLoaded', () => {
        AdBlocker.init();
    });
    
    export default AdBlocker;