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

    function ensureMainContentTarget() {
        const mainContent = document.querySelector("main.main-content") || document.querySelector("main");
        if (!mainContent) {
            return;
        }

        if (!mainContent.id) {
            mainContent.id = "conteudo-principal";
        }

        if (!mainContent.hasAttribute("tabindex")) {
            mainContent.setAttribute("tabindex", "-1");
        }

        const skipLink = document.querySelector(".skip-link");
        if (skipLink) {
            skipLink.setAttribute("href", `#${mainContent.id}`);
        }
    }

    function ensureFooterInsideBody() {
        const footerContainer = document.getElementById("footer");
        if (!footerContainer || footerContainer.parentElement === document.body) {
            return;
        }

        document.body.appendChild(footerContainer);
    }

    function getPreviousHeadingText(element) {
        let sibling = element.previousElementSibling;

        while (sibling) {
            if (/^H[1-6]$/.test(sibling.tagName)) {
                return sibling.textContent.replace(/\s+/g, " ").trim();
            }

            sibling = sibling.previousElementSibling;
        }

        return "";
    }

    function ensureTableCaptions() {
        const tables = document.querySelectorAll("main table.tabela-vitrine");
        if (tables.length === 0) {
            return;
        }

        tables.forEach(function (table, index) {
            if (table.querySelector(":scope > caption")) {
                return;
            }

            const headingText = getPreviousHeadingText(table);
            const caption = document.createElement("caption");
            caption.className = "sr-only";
            caption.textContent = headingText || `Tabela ${index + 1}`;
            table.insertBefore(caption, table.firstChild);
        });
    }

    function ensureBlankTargetSafety() {
        document.querySelectorAll('a[target="_blank"]').forEach(function (link) {
            const relParts = (link.getAttribute("rel") || "")
                .split(/\s+/)
                .map(function (part) {
                    return part.trim().toLowerCase();
                })
                .filter(Boolean);

            if (!relParts.includes("noopener")) {
                relParts.push("noopener");
            }

            if (!relParts.includes("noreferrer")) {
                relParts.push("noreferrer");
            }

            link.setAttribute("rel", relParts.join(" "));
        });
    }

    function ensureImageAltAttributes() {
        document.querySelectorAll("img:not([alt])").forEach(function (img) {
            if (img.id === "modalImage") {
                img.setAttribute("alt", "Imagem ampliada");
                return;
            }

            const src = (img.getAttribute("src") || "").toLowerCase();
            if (src.includes("/classificacao/")) {
                img.setAttribute("alt", "Classificacao indicativa");
                return;
            }

            if (img.closest(".header-brand")) {
                img.setAttribute("alt", "Logotipo");
                return;
            }

            if (img.closest(".sidebar-galeria") || img.closest(".main-galeria")) {
                img.setAttribute("alt", "Foto da galeria");
                return;
            }

            img.setAttribute("alt", "");
        });
    }

    function setupImageModalZoom() {
        const modal = document.getElementById("imageModal");
        const modalImg = document.getElementById("modalImage");

        if (!modal || !modalImg) {
            return;
        }

        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
        modal.setAttribute("aria-label", "Visualizacao ampliada da imagem");
        modal.setAttribute("aria-hidden", "true");

        let lastFocusedElement = null;

        function openModal(sourceImg) {
            lastFocusedElement = document.activeElement;
            modal.style.display = "flex";
            modal.setAttribute("aria-hidden", "false");
            document.body.style.overflow = "hidden";
            modalImg.src = sourceImg.src;
            modalImg.alt = sourceImg.alt ? sourceImg.alt : "Imagem ampliada";

            const closeModalButton = document.querySelector(".close-modal");
            if (closeModalButton) {
                closeModalButton.focus();
            }
        }

        function closeModal() {
            modal.style.display = "none";
            modal.setAttribute("aria-hidden", "true");
            document.body.style.overflow = "";
            if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
                lastFocusedElement.focus();
            }
        }

        document.querySelectorAll(".sidebar img, .main-galeria img").forEach(function (img) {
            if (img.dataset.zoomBound === "true") {
                return;
            }

            img.dataset.zoomBound = "true";
            const hasNativeInteractiveParent = Boolean(img.closest("a, button"));

            if (!hasNativeInteractiveParent) {
                if (!img.hasAttribute("tabindex")) {
                    img.setAttribute("tabindex", "0");
                }

                if (!img.hasAttribute("role")) {
                    img.setAttribute("role", "button");
                }

                if (!img.hasAttribute("aria-label")) {
                    const baseAlt = (img.getAttribute("alt") || "imagem").trim();
                    img.setAttribute("aria-label", `Ampliar ${baseAlt}`);
                }
            }

            img.addEventListener("click", function () {
                openModal(img);
            });

            img.addEventListener("keydown", function (event) {
                if (hasNativeInteractiveParent) {
                    return;
                }

                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openModal(img);
                }
            });
        });

        const closeModalControl = document.querySelector(".close-modal");
        if (closeModalControl && closeModalControl.dataset.modalBound !== "true") {
            closeModalControl.dataset.modalBound = "true";
            closeModalControl.setAttribute("role", "button");
            closeModalControl.setAttribute("tabindex", "0");
            closeModalControl.setAttribute("aria-label", "Fechar visualizacao ampliada");

            closeModalControl.addEventListener("click", function () {
                closeModal();
            });

            closeModalControl.addEventListener("keydown", function (event) {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    closeModal();
                }
            });
        }

        if (modal.dataset.modalBound !== "true") {
            modal.dataset.modalBound = "true";
            modal.addEventListener("click", function (event) {
                if (event.target === modal) {
                    closeModal();
                }
            });

            document.addEventListener("keydown", function (event) {
                if (event.key === "Escape" && modal.style.display === "flex") {
                    closeModal();
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

    function normalizePersonName(value) {
        return (value || "").replace(/\s+/g, " ").trim();
    }

    function splitCsvLine(line, delimiter) {
        const values = [];
        let current = "";
        let insideQuotes = false;

        for (let index = 0; index < line.length; index += 1) {
            const char = line[index];

            if (char === '"') {
                const nextChar = line[index + 1];

                if (insideQuotes && nextChar === '"') {
                    current += '"';
                    index += 1;
                    continue;
                }

                insideQuotes = !insideQuotes;
                continue;
            }

            if (char === delimiter && !insideQuotes) {
                values.push(current);
                current = "";
                continue;
            }

            current += char;
        }

        values.push(current);
        return values;
    }

    function detectCsvDelimiter(line) {
        const commaCount = (line.match(/,/g) || []).length;
        const semicolonCount = (line.match(/;/g) || []).length;

        if (semicolonCount > commaCount) {
            return ";";
        }

        return ",";
    }

    async function loadPeopleLinksMap(csvUrl) {
        const peopleLinks = new Map();

        try {
            const response = await fetch(csvUrl, { cache: "no-store" });
            if (!response.ok) {
                return peopleLinks;
            }

            const csvText = await response.text();
            const lines = csvText.split(/\r?\n/).filter(function (line) {
                return line.trim() !== "";
            });

            lines.forEach(function (rawLine) {
                const line = rawLine.trim();
                if (!line || line.startsWith("#")) {
                    return;
                }

                const delimiter = detectCsvDelimiter(line);
                const columns = splitCsvLine(line, delimiter).map(function (part) {
                    return part.trim();
                });

                if (columns.length < 2) {
                    return;
                }

                const name = normalizePersonName(columns[0]);
                const link = columns[1];
                if (!name || !link) {
                    return;
                }

                const isHeader = normalizeText(name) === "nome" && normalizeText(link) === "link";
                if (isHeader) {
                    return;
                }

                peopleLinks.set(name, link);
            });
        } catch (error) {
            console.error("Falha ao carregar CSV de pessoas:", error);
        }

        return peopleLinks;
    }

    function isCreditsTable(table) {
        if (table.classList.contains("tabela-elenco") || table.classList.contains("tabela-ficha")) {
            return true;
        }

        const heading = normalizeText(getPreviousHeadingText(table));
        if (heading.includes("elenco") || heading.includes("ficha tecnica")) {
            return true;
        }

        const headers = Array.from(table.querySelectorAll("th")).map(function (th) {
            return normalizeText(th.textContent);
        });

        return headers.some(function (value) {
            return value.includes("ator") || value.includes("atriz") || value.includes("personagem") || value.includes("responsavel");
        });
    }

    function sanitizeCandidatePersonName(value) {
        return normalizePersonName((value || "").replace(/[;,]+$/g, ""));
    }

    function extractMultiplePeopleFromCell(cell) {
        const cellText = (cell.textContent || "").replace(/\u00a0/g, " ").trim();
        const hasLineBreak = Boolean(cell.querySelector("br"));
        const hasComma = cellText.includes(",");

        if (!hasLineBreak && !hasComma) {
            return [];
        }

        const candidates = cellText
            .split(/\n|,/)
            .map(function (value) {
                return sanitizeCandidatePersonName(value);
            })
            .filter(Boolean);

        const uniqueNames = [];
        candidates.forEach(function (name) {
            if (!uniqueNames.includes(name)) {
                uniqueNames.push(name);
            }
        });

        return uniqueNames.length > 1 ? uniqueNames : [];
    }

    function buildInlinePersonButtons(cell, personNames, peopleLinks) {
        const fragment = document.createDocumentFragment();
        let hasLinkedPerson = false;

        personNames.forEach(function (name) {
            const personLink = peopleLinks.get(name);
            if (!personLink) {
                const text = document.createElement("span");
                text.className = "credits-person-inline-text";
                text.textContent = name;
                fragment.appendChild(text);
                return;
            }

            hasLinkedPerson = true;

            const button = document.createElement("button");
            button.type = "button";
            button.className = "credits-person-inline-button";
            button.textContent = name;
            button.setAttribute("aria-label", `Abrir site de ${name}`);
            button.setAttribute("title", `Abrir site de ${name}`);

            button.addEventListener("click", function () {
                window.open(personLink, "_blank", "noopener,noreferrer");
            });

            fragment.appendChild(button);
        });

        if (!hasLinkedPerson) {
            return false;
        }

        cell.textContent = "";
        cell.classList.add("credits-person-cell-multi");
        cell.appendChild(fragment);
        return true;
    }

    function linkCreditsPeopleCells(peopleLinks) {
        if (peopleLinks.size === 0) {
            return;
        }

        const content = document.querySelector("main.main-content") || document.querySelector("main");
        if (!content) {
            return;
        }

        content.querySelectorAll("table").forEach(function (table) {
            if (!isCreditsTable(table)) {
                return;
            }

            table.querySelectorAll("td").forEach(function (cell) {
                if (cell.dataset.personLinkBound === "true") {
                    return;
                }

                const multiplePeople = extractMultiplePeopleFromCell(cell);
                if (multiplePeople.length > 1) {
                    const hasRenderedButtons = buildInlinePersonButtons(cell, multiplePeople, peopleLinks);
                    if (hasRenderedButtons) {
                        cell.dataset.personLinkBound = "true";
                        return;
                    }
                }

                const cellValue = normalizePersonName(cell.textContent);
                if (!cellValue) {
                    return;
                }

                const personLink = peopleLinks.get(cellValue);
                if (!personLink) {
                    return;
                }

                const openPersonWebsite = function () {
                    window.open(personLink, "_blank", "noopener,noreferrer");
                };

                cell.classList.add("credits-person-cell-button");
                cell.setAttribute("role", "button");
                cell.setAttribute("tabindex", "0");
                cell.setAttribute("aria-label", `Abrir site de ${cellValue}`);
                cell.setAttribute("title", `Abrir site de ${cellValue}`);

                cell.addEventListener("click", openPersonWebsite);
                cell.addEventListener("keydown", function (event) {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openPersonWebsite();
                    }
                });

                cell.dataset.personLinkBound = "true";
            });
        });
    }

    async function applyPeopleLinksFromCsv() {
        if (!/\/espetaculos(\/|$)/.test(window.location.pathname)) {
            return;
        }

        const peopleLinks = await loadPeopleLinksMap("/espetaculos/pessoas-links.csv");
        linkCreditsPeopleCells(peopleLinks);
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

    function setupShowsSearchFilter() {
        const searchInput = document.getElementById("acervo-busca");
        const status = document.getElementById("acervo-status");
        if (!searchInput || !status) {
            return;
        }

        const sections = [];
        document.querySelectorAll("main.main-content h2[id]").forEach(function (heading) {
            const table = heading.nextElementSibling && heading.nextElementSibling.nextElementSibling;
            if (!table || !table.classList.contains("grade-espetaculos")) {
                return;
            }

            const rows = Array.from(table.querySelectorAll(".cartaz-row"));
            if (rows.length === 0) {
                return;
            }

            sections.push({
                heading: heading,
                separator: heading.nextElementSibling,
                table: table,
                rows: rows
            });
        });

        if (sections.length === 0) {
            return;
        }

        function applyFilter() {
            const query = normalizeText(searchInput.value);
            let visibleRows = 0;

            sections.forEach(function (section) {
                let sectionVisible = 0;

                section.rows.forEach(function (row) {
                    const title = normalizeText(row.querySelector(".cartaz-link") ? row.querySelector(".cartaz-link").textContent : "");
                    const summary = normalizeText(row.querySelector(".cartaz-resumo") ? row.querySelector(".cartaz-resumo").textContent : "");
                    const match = query === "" || title.includes(query) || summary.includes(query);

                    row.style.display = match ? "" : "none";
                    if (match) {
                        sectionVisible++;
                    }
                });

                section.heading.style.display = sectionVisible > 0 ? "" : "none";
                section.separator.style.display = sectionVisible > 0 ? "" : "none";
                section.table.style.display = sectionVisible > 0 ? "" : "none";

                visibleRows += sectionVisible;
            });

            if (query === "") {
                status.textContent = "Mostrando todo o acervo.";
                return;
            }

            if (visibleRows === 0) {
                status.textContent = "Nenhum espetáculo encontrado para esta busca.";
                return;
            }

            status.textContent = `${visibleRows} espetáculo(s) encontrado(s).`;
        }

        searchInput.addEventListener("input", applyFilter);
        applyFilter();
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

    function ensureMediaPerformanceHints() {
        const images = Array.from(document.querySelectorAll("img"));
        if (images.length === 0) {
            return;
        }

        images.forEach(function (img) {
            if (!img.hasAttribute("decoding")) {
                img.setAttribute("decoding", "async");
            }

            const isHeaderLogo = Boolean(img.closest(".header-brand"));
            const isLikelyHero = Boolean(img.closest(".cbt-cartaz"));
            const isModalImage = img.id === "modalImage";

            if (!img.hasAttribute("loading") && !isHeaderLogo && !isLikelyHero && !isModalImage) {
                img.setAttribute("loading", "lazy");
            }

            if (img.getAttribute("loading") === "lazy" && !img.hasAttribute("fetchpriority")) {
                img.setAttribute("fetchpriority", "low");
            }
        });
    }

    function setupQuickConversionBar() {
        if (document.body && document.body.dataset.disableQuickCta === "true") {
            return;
        }

        let ticketCta = document.querySelector("a.btn-cta-ticket[href]");
        let ticketLabel = "Comprar ingresso";

        if (!ticketCta) {
            ticketCta = document.querySelector("a.btn-cta[href*='forms.gle'], a.btn-cta[href*='docs.google.com/forms']");

            if (ticketCta) {
                ticketLabel = "Garantir vaga";
            }
        }

        const whatsappCta = document.querySelector("a.btn-cta-whatsapp[href]");

        if (!ticketCta && !whatsappCta) {
            return;
        }

        if (document.querySelector(".quick-cta-bar")) {
            return;
        }

        const bar = document.createElement("div");
        bar.className = "quick-cta-bar";
        bar.setAttribute("role", "region");
        bar.setAttribute("aria-label", "Acoes rapidas de conversao");

        if (ticketCta) {
            const ticketLink = document.createElement("a");
            ticketLink.className = "quick-cta quick-cta-ticket";
            ticketLink.href = ticketCta.href;
            ticketLink.target = "_blank";
            ticketLink.rel = "noopener noreferrer";
            ticketLink.textContent = ticketLabel;
            bar.appendChild(ticketLink);
        }

        if (whatsappCta) {
            const whatsappLink = document.createElement("a");
            whatsappLink.className = "quick-cta quick-cta-whatsapp";
            whatsappLink.href = whatsappCta.href;
            whatsappLink.target = "_blank";
            whatsappLink.rel = "noopener noreferrer";
            whatsappLink.textContent = "Suporte";
            bar.appendChild(whatsappLink);
        }

        document.body.appendChild(bar);
        document.body.classList.add("has-quick-cta");
    }

    function setupEngagementTracking() {
        function classifyLink(href) {
            const normalizedHref = (href || "").toLowerCase();

            if (normalizedHref.includes("sympla.com.br")) {
                return "ticket_click";
            }

            if (normalizedHref.includes("wa.me") || normalizedHref.includes("whatsapp")) {
                return "whatsapp_click";
            }

            if (normalizedHref.includes("forms.gle") || normalizedHref.includes("docs.google.com/forms")) {
                return "form_click";
            }

            return "outbound_click";
        }

        function pushTrackingEvent(eventName, href) {
            const payload = {
                event: eventName,
                href: href,
                page: window.location.pathname,
                ts: new Date().toISOString()
            };

            if (Array.isArray(window.dataLayer)) {
                window.dataLayer.push(payload);
            }

            if (typeof window.gtag === "function") {
                window.gtag("event", eventName, {
                    link_url: href,
                    page_path: window.location.pathname
                });
            }

            try {
                const key = "aeca-engagement-events";
                const items = JSON.parse(localStorage.getItem(key) || "[]");
                items.push(payload);
                const trimmed = items.slice(-150);
                localStorage.setItem(key, JSON.stringify(trimmed));
            } catch (error) {
                // Evita quebrar navegacao se localStorage estiver indisponivel.
            }
        }

        document.addEventListener("click", function (event) {
            const link = event.target.closest("a[href]");
            if (!link) {
                return;
            }

            const href = link.getAttribute("href") || "";
            if (!href) {
                return;
            }

            const eventName = classifyLink(href);
            pushTrackingEvent(eventName, href);
        });
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
        ensureMainContentTarget();
        ensureFooterInsideBody();
        await buildShowsAsTables();
        setupShowsSearchFilter();
        normalizeLegacyShowTables();
        await applyPeopleLinksFromCsv();
        ensureImageAltAttributes();
        ensureTableCaptions();
        ensureBlankTargetSafety();
        ensureMediaPerformanceHints();
        setupQuickConversionBar();
        setupEngagementTracking();
        setupImageModalZoom();
        setupScrollToTop();
    }

    document.addEventListener("DOMContentLoaded", function () {
        setupScrollPersistence();
        bootstrap();
    });
})();
