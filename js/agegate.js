/* 18+ age gate. Blocks the whole app until the user confirms.
 * Confirmation is stored in this browser so it isn't asked every visit. */
(function () {
  APP.AgeGate = {
    // Returns true if already confirmed; otherwise shows the gate.
    // `onEnter` runs once the user confirms (or was already confirmed).
    init(onEnter) {
      const gate = document.getElementById('age-gate');
      const app = document.getElementById('app');

      if (APP.Store.isAgeConfirmed()) {
        gate.hidden = true;
        app.hidden = false;
        onEnter();
        return;
      }

      gate.hidden = false;
      app.hidden = true;

      document.getElementById('age-confirm').addEventListener('click', () => {
        APP.Store.confirmAge();
        gate.hidden = true;
        app.hidden = false;
        onEnter();
      });
    },
  };
})();
