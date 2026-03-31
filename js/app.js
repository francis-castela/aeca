(function () {
    const THEME_KEY = "aeca-theme";
    const SCROLL_KEY = "scrollPosition";

    function getPreferredTheme() {
        const savedTheme = localStorage.getItem(THEME_KEY);
        if (savedTheme === "light" || savedTheme === "dark") {
            return savedTheme;
        }

        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    function applyTheme(theme) {
        const nextTheme = theme === "dark" ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", nextTheme);
        localStorage.setItem(THEME_KEY, nextTheme);
    }

    function refreshThemeButton() {
        const toggleButton = document.getElementById("theme-toggle");
        if (!toggleButton) {
            return;
        }

        const isDark = document.documentElement.getAttribute("data-theme") === "dark";

        toggleButton.setAttribute("aria-pressed", String(isDark));
        toggleButton.textContent = isDark ? "☀️" : "🌙";
        toggleButton.setAttribute("title", isDark ? "Ativar modo claro" : "Ativar modo escuro");
        toggleButton.setAttribute("aria-label", isDark ? "Ativar modo claro" : "Ativar modo escuro");
    }

    function setupThemeToggle() {
        const toggleButton = document.getElementById("theme-toggle");
        if (!toggleButton || toggleButton.dataset.bound === "true") {
            refreshThemeButton();
            return;
        }

        toggleButton.dataset.bound = "true";
        toggleButton.addEventListener("click", function () {
            const currentTheme = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
            applyTheme(currentTheme === "dark" ? "light" : "dark");
            refreshThemeButton();
        });

        refreshThemeButton();
    }

    function setupNavMenu() {
        const menuToggle = document.getElementById("nav-menu-toggle");
        const navLinks = document.getElementById("nav-links");

        if (!menuToggle || !navLinks || menuToggle.dataset.bound === "true") {
            return;
        }

        menuToggle.dataset.bound = "true";
        let isOpen = false;

        menuToggle.addEventListener("click", function () {
            isOpen = !isOpen;
            navLinks.classList.toggle("open", isOpen);
            menuToggle.setAttribute("aria-expanded", String(isOpen));
            menuToggle.setAttribute("aria-label", isOpen ? "Fechar menu" : "Abrir menu");
            menuToggle.setAttribute("title", isOpen ? "Fechar menu" : "Abrir menu");
        });

        navLinks.querySelectorAll("a").forEach(function (link) {
            link.addEventListener("click", function () {
                isOpen = false;
                navLinks.classList.remove("open");
                menuToggle.setAttribute("aria-expanded", "false");
                menuToggle.setAttribute("aria-label", "Abrir menu");
                menuToggle.setAttribute("title", "Abrir menu");
            });
        });
    }

    async function injectFragment(url, targetId) {
        const target = document.getElementById(targetId);
        if (!target) {
            return;
        }

        try {
            const response = await fetch(url);
            if (!response.ok) {
                return;
            }

            target.innerHTML = await response.text();
        } catch (error) {
            console.error("Falha ao carregar fragmento:", url, error);
        }
    }

    function setupImageModalZoom() {
        const modal = document.getElementById("imageModal");
        const modalImg = document.getElementById("modalImage");

        if (!modal || !modalImg) {
            return;
        }

        document.querySelectorAll(".sidebar img, .main-galeria img").forEach(function (img) {
            if (img.dataset.zoomBound === "true") {
                return;
            }

            img.dataset.zoomBound = "true";
            img.addEventListener("click", function () {
                modal.style.display = "flex";
                modalImg.src = img.src;
            });
        });

        const closeModal = document.querySelector(".close-modal");
        if (closeModal && closeModal.dataset.modalBound !== "true") {
            closeModal.dataset.modalBound = "true";
            closeModal.addEventListener("click", function () {
                modal.style.display = "none";
            });
        }

        if (modal.dataset.modalBound !== "true") {
            modal.dataset.modalBound = "true";
            modal.addEventListener("click", function (event) {
                if (event.target === modal) {
                    modal.style.display = "none";
                }
            });
        }
    }

    function normalizeText(value) {
        return (value || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();
    }

    function getLegacyTableType(table) {
        let sibling = table.previousElementSibling;
        while (sibling) {
            const tag = sibling.tagName;
            if (tag === "H2" || tag === "H3") {
                const section = normalizeText(sibling.textContent);

                if (section.includes("ficha tecnica")) {
                    return "ficha";
                }

                if (section.includes("elenco")) {
                    return "elenco";
                }

                if (section.includes("sess") || section.includes("agenda") || section.includes("datas")) {
                    return "agenda";
                }

                if (section.includes("ingresso") || section.includes("venda")) {
                    return "precos";
                }

                break;
            }

            sibling = sibling.previousElementSibling;
        }

        return "default";
    }

    function ensureTableBody(table) {
        let tbody = table.querySelector(":scope > tbody");
        if (tbody) {
            return tbody;
        }

        tbody = document.createElement("tbody");
        const directRows = Array.from(table.children).filter(function (child) {
            return child.tagName === "TR";
        });

        directRows.forEach(function (row) {
            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        return tbody;
    }

    function ensureTableHead(table, tableType) {
        let thead = table.querySelector(":scope > thead");
        if (thead) {
            return thead;
        }

        if (tableType !== "elenco" && tableType !== "ficha") {
            return null;
        }

        thead = document.createElement("thead");
        const row = document.createElement("tr");
        const left = document.createElement("th");
        const right = document.createElement("th");

        if (tableType === "elenco") {
            left.textContent = "Personagem";
            right.textContent = "Ator / Atriz";
        } else {
            left.textContent = "Função";
            right.textContent = "Responsável";
        }

        left.setAttribute("scope", "col");
        right.setAttribute("scope", "col");
        row.appendChild(left);
        row.appendChild(right);
        thead.appendChild(row);
        table.insertBefore(thead, table.firstChild);

        return thead;
    }

    function getHeaderLabels(table, tableType) {
        const headers = Array.from(table.querySelectorAll(":scope > thead th"))
            .map(function (th) {
                return th.textContent.replace(/\s+/g, " ").trim();
            })
            .filter(Boolean);

        if (headers.length > 0) {
            return headers;
        }

        if (tableType === "elenco") {
            return ["Personagem", "Ator / Atriz"];
        }

        if (tableType === "ficha") {
            return ["Função", "Responsável"];
        }

        return [];
    }

    function normalizeLegacyShowTables() {
        const pageMatch = window.location.pathname.match(/\/espetaculos\/(\d{4})\//);
        if (!pageMatch) {
            return;
        }

        const year = Number(pageMatch[1]);
        if (!Number.isFinite(year) || year >= 2026) {
            return;
        }

        const content = document.querySelector("main.main-content");
        if (!content) {
            return;
        }

        const tables = Array.from(content.querySelectorAll("table"));
        tables.forEach(function (table) {
            const tableType = getLegacyTableType(table);

            table.classList.add("tabela-vitrine");
            if (tableType === "precos") {
                table.classList.add("tabela-precos", "tabela-centralizadogrande");
            } else if (tableType === "agenda") {
                table.classList.add("tabela-agenda", "tabela-centralizadogrande");
            } else if (tableType === "elenco") {
                table.classList.add("tabela-elenco");
            } else if (tableType === "ficha") {
                table.classList.add("tabela-ficha");
            }

            const thead = ensureTableHead(table, tableType);
            if (thead) {
                thead.querySelectorAll("th").forEach(function (th) {
                    th.setAttribute("scope", "col");
                });
            }

            const tbody = ensureTableBody(table);
            const labels = getHeaderLabels(table, tableType);

            tbody.querySelectorAll("tr").forEach(function (row) {
                const cells = Array.from(row.children).filter(function (cell) {
                    return cell.tagName === "TH" || cell.tagName === "TD";
                });

                if (cells.length === 0) {
                    return;
                }

                const firstCell = cells[0];
                if (firstCell.tagName === "TD") {
                    const rowHeader = document.createElement("th");
                    rowHeader.innerHTML = firstCell.innerHTML;
                    Array.from(firstCell.attributes).forEach(function (attr) {
                        if (attr.name !== "data-label") {
                            rowHeader.setAttribute(attr.name, attr.value);
                        }
                    });
                    row.replaceChild(rowHeader, firstCell);
                    cells[0] = rowHeader;
                }

                cells[0].setAttribute("scope", "row");

                cells.forEach(function (cell, index) {
                    if (cell.tagName !== "TD") {
                        return;
                    }

                    const fallbackLabel = `Coluna ${index + 1}`;
                    const label = labels[index] || fallbackLabel;
                    cell.setAttribute("data-label", label);
                });
            });
        });
    }

    function normalizeShowHref(href) {
        if (!href) {
            return "";
        }

        if (href.endsWith(".html")) {
            return href;
        }

        return `${href}.html`;
    }

    function getSummaryCharacterLimit() {
        return window.matchMedia("(max-width: 768px)").matches ? 160 : null;
    }

    function extractFirstSummary(htmlText) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, "text/html");
            const main = doc.querySelector("main.main-content") || doc.body;
            const firstParagraph = main ? main.querySelector("p") : null;
            if (!firstParagraph) {
                return "Resumo indisponivel.";
            }

            const normalized = firstParagraph.textContent.replace(/\s+/g, " ").trim();
            if (!normalized) {
                return "Resumo indisponivel.";
            }

            const maxChars = getSummaryCharacterLimit();
            if (!maxChars) {
                return normalized;
            }

            const cutoff = Math.max(maxChars - 3, 0);
            return normalized.length > maxChars ? `${normalized.slice(0, cutoff).trimEnd()}...` : normalized;
        } catch (error) {
            return "Resumo indisponivel.";
        }
    }

    async function buildShowsAsTables() {
        const showGrids = Array.from(document.querySelectorAll(".grade-espetaculos"));
        if (showGrids.length === 0) {
            return;
        }

        const summaryCache = new Map();

        for (const grid of showGrids) {
            const showLinks = Array.from(grid.querySelectorAll("a[href]"));
            if (showLinks.length === 0) {
                continue;
            }

            const table = document.createElement("table");
            table.className = "grade-espetaculos";

            const tbody = document.createElement("tbody");

            for (const link of showLinks) {
                const href = link.getAttribute("href") || "";
                const imgEl = link.querySelector("img");
                const imgSrc = imgEl ? imgEl.getAttribute("src") || "" : "";
                const title = link.textContent.replace(/\s+/g, " ").trim();
                const summaryUrl = normalizeShowHref(href);
                const rowUrl = summaryUrl || href;

                const row = document.createElement("tr");
                row.className = "cartaz-row";

                if (rowUrl) {
                    row.tabIndex = 0;
                    row.setAttribute("role", "link");
                    row.setAttribute("aria-label", `Abrir pagina do espetaculo ${title}`);

                    const navigateToShow = function () {
                        window.location.href = rowUrl;
                    };

                    row.addEventListener("click", navigateToShow);
                    row.addEventListener("keydown", function (event) {
                        if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            navigateToShow();
                        }
                    });
                }

                const posterCell = document.createElement("td");
                posterCell.className = "cartaz-col-poster";

                const posterImg = document.createElement("img");
                posterImg.src = imgSrc;
                posterImg.alt = `Cartaz de ${title}`;
                posterImg.loading = "lazy";

                posterCell.appendChild(posterImg);

                const infoCell = document.createElement("td");
                infoCell.className = "cartaz-col-info";

                const titleLink = document.createElement("p");
                titleLink.className = "cartaz-link";
                titleLink.textContent = title;

                const summaryEl = document.createElement("p");
                summaryEl.className = "cartaz-resumo";
                summaryEl.textContent = "Carregando resumo...";

                infoCell.appendChild(titleLink);
                infoCell.appendChild(summaryEl);

                row.appendChild(posterCell);
                row.appendChild(infoCell);
                tbody.appendChild(row);

                if (!summaryUrl) {
                    summaryEl.textContent = "Resumo indisponivel.";
                    continue;
                }

                if (summaryCache.has(summaryUrl)) {
                    summaryEl.textContent = summaryCache.get(summaryUrl);
                    continue;
                }

                (async function () {
                    try {
                        const response = await fetch(summaryUrl);
                        if (!response.ok) {
                            summaryCache.set(summaryUrl, "Resumo indisponivel.");
                            summaryEl.textContent = "Resumo indisponivel.";
                            return;
                        }

                        const htmlText = await response.text();
                        const summary = extractFirstSummary(htmlText);
                        summaryCache.set(summaryUrl, summary);
                        summaryEl.textContent = summary;
                    } catch (error) {
                        summaryCache.set(summaryUrl, "Resumo indisponivel.");
                        summaryEl.textContent = "Resumo indisponivel.";
                    }
                })();
            }

            table.appendChild(tbody);
            grid.replaceWith(table);
        }
    }

    function setupScrollPersistence() {
        window.addEventListener("beforeunload", function () {
            sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
        });

        window.addEventListener("load", function () {
            const storedPosition = sessionStorage.getItem(SCROLL_KEY);
            if (storedPosition === null) {
                return;
            }

            window.scrollTo(0, Number(storedPosition));
            sessionStorage.removeItem(SCROLL_KEY);
        });
    }

    function setupScrollToTop() {
        if (document.body && document.body.dataset.disableScrollTop === "true") {
            return;
        }

        const btn = document.createElement("button");
        btn.id = "scroll-topo";
        btn.type = "button";
        btn.textContent = "⬆";
        btn.setAttribute("aria-label", "Voltar ao topo");
        btn.setAttribute("title", "Voltar ao topo");
        document.body.appendChild(btn);

        let scrollAnimationId = null;

        function smoothScrollToTop(durationMs) {
            const startY = window.scrollY || window.pageYOffset;
            if (startY <= 0) {
                return;
            }

            const startTime = performance.now();
            if (scrollAnimationId !== null) {
                cancelAnimationFrame(scrollAnimationId);
            }

            function animateFrame(now) {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / durationMs, 1);
                const easedProgress = 1 - Math.pow(1 - progress, 3);
                const nextY = Math.round(startY * (1 - easedProgress));

                window.scrollTo(0, nextY);

                if (progress < 1) {
                    scrollAnimationId = requestAnimationFrame(animateFrame);
                    return;
                }

                scrollAnimationId = null;
            }

            scrollAnimationId = requestAnimationFrame(animateFrame);
        }

        btn.addEventListener("click", function () {
            smoothScrollToTop(420);
        });

        const cabecalho = document.getElementById("cabecalho");
        if (!cabecalho) {
            return;
        }

        const observer = new IntersectionObserver(function (entries) {
            btn.classList.toggle("visivel", !entries[0].isIntersecting);
        }, { threshold: 0 });

        observer.observe(cabecalho);
    }

    async function bootstrap() {
        applyTheme(getPreferredTheme());

        await Promise.all([
            injectFragment("/html/cabecalho.html", "cabecalho"),
            injectFragment("/html/footer.html", "footer"),
            injectFragment("/html/aside-padrao.html", "aside-padrao")
        ]);

        setupThemeToggle();
        setupNavMenu();
        await buildShowsAsTables();
        normalizeLegacyShowTables();
        setupImageModalZoom();
        setupScrollToTop();
    }

    document.addEventListener("DOMContentLoaded", function () {
        setupScrollPersistence();
        bootstrap();
    });
})();
