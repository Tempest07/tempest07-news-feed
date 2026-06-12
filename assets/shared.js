const root = document.documentElement;
const savedTheme = localStorage.getItem("tempest-theme");

if (location.hostname === "tempest07-news-feed.pages.dev") {
  location.replace(`https://tempest07.com/newsfeed/${location.search}${location.hash}`);
}

if (savedTheme) {
  root.dataset.theme = savedTheme;
}

document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    localStorage.setItem("tempest-theme", next);
  });
});

document.querySelectorAll("[data-today]").forEach((element) => {
  element.textContent = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());
});
