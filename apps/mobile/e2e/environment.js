/**
 * Detox-provided Jest environment. Declared as a separate module so
 * `jest.config.js` can reference it by path; keeps the config JSON-safe.
 */
const {
  DetoxCircusEnvironment,
  SpecReporter,
  WorkerAssignReporter,
} = require("detox/runners/jest");

class CustomDetoxEnvironment extends DetoxCircusEnvironment {
  constructor(config, context) {
    super(config, context);
    // Matches the default Detox stream reporter layout. We keep it
    // explicit so future plug-ins (coverage, flakiness tracker) can be
    // appended without grep-replacing `jest.config.js`.
    this.initTimeout = 300_000;
    this.registerListeners({
      SpecReporter,
      WorkerAssignReporter,
    });
  }
}

module.exports = CustomDetoxEnvironment;
