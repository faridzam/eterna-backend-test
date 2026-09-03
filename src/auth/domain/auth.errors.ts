export class DuplicateEmailError extends Error {
  constructor() {
    super('An account already exists for that email address.');
  }
}
