(() => {
  const freeCellButton = document.querySelector("#historyFreeCellButton");
  freeCellButton?.addEventListener("click", () => {
    if (window.parent !== window) {
      window.parent.postMessage({ type: "slowly-freecell-open", mode: "freecell" }, window.location.origin);
      return;
    }
    window.location.href = "../freecell.html";
  });

  // 歷史淵源第五張主題牌：進入獨立作弊模擬器，維持帝國 iframe 導覽。
  document.querySelector("#historyCheatButton")?.addEventListener("click", () => {
    if (window.parent !== window) {
      window.parent.postMessage({ type: "slowly-freecell-open", mode: "cheat" }, window.location.origin);
      return;
    }
    window.location.href = "./cheat/cheat.html";
  });

  const leaveButton = document.querySelector("#leaveHistoryButton");
  leaveButton?.addEventListener("click", () => {
    if (window.parent !== window) {
      window.parent.postMessage({ type: "slowly-freecell-leave", mode: "history" }, window.location.origin);
      return;
    }
    if (window.history.length > 1) window.history.back();
  });

  const topics = Array.from(document.querySelectorAll("[data-history-topic]"));
  const prevButton = document.querySelector("#historyPrevButton");
  const nextButton = document.querySelector("#historyNextButton");
  const pageInfo = document.querySelector("#historyPageInfo");
  const pageSize = window.FreeCellHistory?.pageSize || 3;
  let currentPage = 1;

  function renderTopicPage(page) {
    if (!window.FictionPaginate || !topics.length) return;

    const result = window.FictionPaginate.paginate(topics, {
      page,
      pageSize
    });

    const visible = new Set(result.data);
    topics.forEach((topic) => {
      topic.hidden = !visible.has(topic);
    });

    currentPage = result.page;
    if (pageInfo) pageInfo.textContent = `${result.page} / ${result.totalPages}`;
    if (prevButton) prevButton.disabled = !result.hasPrevious;
    if (nextButton) nextButton.disabled = !result.hasNext;
  }

  prevButton?.addEventListener("click", () => renderTopicPage(currentPage - 1));
  nextButton?.addEventListener("click", () => renderTopicPage(currentPage + 1));

  renderTopicPage(1);
})();
