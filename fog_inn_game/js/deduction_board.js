/* =====================================================================
   deduction_board.js
   最終推理板：兇手、手法、動機三題。全對即真相大白；答錯失去一盞燈。
   ===================================================================== */
(function (global) {
  "use strict";

  const { DEDUCTION_QUESTIONS } = global.FogInnData;
  const Feedback = global.FogInnFeedback;

  let selectedOptionIdByQuestion = {};
  let callbacks = null;

  function renderQuestions() {
    const questionContainer = document.getElementById("deductionQuestions");
    questionContainer.innerHTML = "";

    DEDUCTION_QUESTIONS.forEach((question) => {
      const questionGroup = document.createElement("div");
      questionGroup.className = "question-group";
      questionGroup.innerHTML = "<h3>" + question.prompt + "</h3>";

      question.options.forEach((option) => {
        const optionButton = document.createElement("button");
        optionButton.type = "button";
        optionButton.className = "option-button";
        optionButton.textContent = option.label;
        optionButton.addEventListener("click", () => {
          selectedOptionIdByQuestion[question.questionId] = option.optionId;
          questionGroup.querySelectorAll(".option-button").forEach((button) => button.classList.remove("is-selected", "slowly-electric-border", "with-glow", "is-active"));
          optionButton.classList.add("is-selected", "slowly-electric-border", "with-glow", "is-active");
          Feedback.playSound("click");
        });
        questionGroup.appendChild(optionButton);
      });
      questionContainer.appendChild(questionGroup);
    });
  }

  function submitAccusation() {
    const resultElement = document.getElementById("deductionResult");
    if (DEDUCTION_QUESTIONS.some((question) => !selectedOptionIdByQuestion[question.questionId])) {
      resultElement.textContent = "三題都要作答，才能指認。";
      return;
    }
    const correctAnswerCount = DEDUCTION_QUESTIONS.filter(
      (question) => selectedOptionIdByQuestion[question.questionId] === question.correctOptionId
    ).length;

    if (correctAnswerCount === DEDUCTION_QUESTIONS.length) {
      callbacks.onSolved();
      return;
    }
    Feedback.playWrongAnswerEffect();
    resultElement.textContent = "推理有誤——三題答對 " + correctAnswerCount + " 題，一盞燈熄滅了。回去再看看線索簿。";
    callbacks.onWrongAccusation();
  }

  function start(sharedCallbacks) {
    callbacks = sharedCallbacks;
    selectedOptionIdByQuestion = {};
    document.getElementById("deductionResult").textContent = "";
    renderQuestions();
    document.getElementById("submitDeductionButton").onclick = submitAccusation;
  }

  global.DeductionBoard = Object.freeze({ start });
})(window);
