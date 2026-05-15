(function () {
    const STORAGE_KEY = "siteTheme";
    const root = document.documentElement;
    const button = document.querySelector("[data-theme-toggle]");

    function applyTheme(theme) {
        const isDark = theme === "dark";
        root.classList.toggle("dark-theme", isDark);

        if (button) {
            button.setAttribute("aria-pressed", String(isDark));
            button.textContent = isDark ? "Modo claro" : "Modo escuro";
        }
    }

    const savedTheme = localStorage.getItem(STORAGE_KEY);
    applyTheme(savedTheme === "dark" ? "dark" : "light");

    if (button) {
        button.addEventListener("click", () => {
            const nextTheme = root.classList.contains("dark-theme") ? "light" : "dark";
            localStorage.setItem(STORAGE_KEY, nextTheme);
            applyTheme(nextTheme);
        });
    }
}());
