const clearButton = document.getElementById("clear-cache");
const returnButton = document.getElementById("return-to-play");
const status = document.getElementById("status");

clearButton.addEventListener("click", async () => {
  clearButton.disabled = true;
  status.textContent = "Clearing cached data...";

  try {
    await window.cpatakeDesktop.clearCache();
    status.textContent = "Cache cleared. You can now return to the game.";
    returnButton.disabled = false;
  } catch (error) {
    status.textContent = `Could not clear the cache: ${error.message}`;
    clearButton.disabled = false;
  }
});

returnButton.addEventListener("click", async () => {
  returnButton.disabled = true;
  status.textContent = "Returning to the game...";

  try {
    await window.cpatakeDesktop.returnToPlay();
  } catch (error) {
    status.textContent = `Could not return to the game: ${error.message}`;
    returnButton.disabled = false;
  }
});
