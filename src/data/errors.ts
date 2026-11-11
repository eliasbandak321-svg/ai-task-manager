/**
 * A data-access failure whose message is written for people and safe to show, such as
 * "Your changes couldn't be saved." Every adapter uses it (or a subclass): storage problems
 * in the local adapter, network and server errors in the HTTP adapter (M6). Rule violations
 * are DomainErrors instead, and invalid input is a ZodError.
 */
export class RepositoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RepositoryError'
  }
}

/** The API says the session is missing or expired: the user needs to sign in (again). */
export class AuthRequiredError extends RepositoryError {
  constructor(message = 'Please sign in to continue.', options?: ErrorOptions) {
    super(message, options)
    this.name = 'AuthRequiredError'
  }
}
